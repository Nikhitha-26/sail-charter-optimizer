from pathlib import Path
from math import ceil
import pandas as pd

# ============================================================
# SAIL CHARTER OPTIMIZER
# Multi-Vessel Charter Allocation Engine
#
# Prototype scheduling assumptions:
# 1. Each vessel can execute multiple voyages sequentially.
# 2. A vessel becomes available after the previous voyage completes.
# 3. Ballast/repositioning time is NOT modeled because it is not
#    present in the supplied voyage dataset.
# 4. Scenario probabilities are NOT invented.
# 5. LOW/BASE/HIGH scenario values are treated as stress cases.
#
# This is a deterministic risk-aware allocation heuristic, not
# a mathematical proof of global optimality.
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

FEASIBILITY_FILE = PROCESSED_DIR / "vessel_port_feasibility.csv"
SCENARIO_FILE = PROCESSED_DIR / "freight_scenarios_90d.csv"
OUTPUT_FILE = PROCESSED_DIR / "charter_optimization_results.csv"
SUMMARY_FILE = PROCESSED_DIR / "charter_optimization_summary.csv"

# Risk-aversion parameter.
# 0.0 = pure base-cost preference.
# Higher values increasingly penalize HIGH-vs-BASE exposure.
RISK_LAMBDA = 0.35

# Large penalty used only when a candidate misses the cargo deadline.
# This keeps deadline satisfaction ahead of small cost differences.
DEADLINE_PENALTY_PER_DAY = 250_000.0

PRIORITY_WEIGHT = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


def load_inputs():
    cargo = pd.read_csv(RAW_DIR / "cargo_requirements.csv")
    cargo["earliest_arrival"] = pd.to_datetime(cargo["earliest_arrival"])
    cargo["required_by"] = pd.to_datetime(cargo["required_by"])

    vessels = pd.read_csv(RAW_DIR / "vessels.csv")
    ports = pd.read_csv(RAW_DIR / "ports.csv")
    voyages = pd.read_csv(RAW_DIR / "voyages.csv")
    freight = pd.read_csv(RAW_DIR / "freight_rates.csv")
    freight["date"] = pd.to_datetime(freight["date"])

    feasibility = pd.read_csv(FEASIBILITY_FILE)

    scenarios = None
    if SCENARIO_FILE.exists():
        scenarios = pd.read_csv(SCENARIO_FILE)
        scenarios["forecast_date"] = pd.to_datetime(scenarios["forecast_date"])

    return cargo, vessels, ports, voyages, freight, feasibility, scenarios


def validate_inputs(cargo, vessels, ports, voyages, freight, feasibility):
    required = {
        "cargo": {
            "cargo_id", "commodity", "quantity_tonnes", "origin",
            "destination", "earliest_arrival", "required_by", "priority"
        },
        "vessels": {
            "vessel_id", "vessel_type", "cargo_capacity_mt",
            "fuel_consumption_laden_mt_day"
        },
        "ports": {
            "port_id", "cargo_handling_rate_tph"
        },
        "voyages": {
            "origin", "destination", "vessel_type",
            "estimated_sailing_days"
        },
        "freight": {
            "date", "origin", "destination", "vessel_type", "freight_rate"
        },
        "feasibility": {
            "cargo_id", "vessel_id", "feasible"
        },
    }

    datasets = {
        "cargo": cargo,
        "vessels": vessels,
        "ports": ports,
        "voyages": voyages,
        "freight": freight,
        "feasibility": feasibility,
    }

    for name, columns in required.items():
        missing = columns - set(datasets[name].columns)
        if missing:
            raise ValueError(
                f"{name} is missing required columns: {sorted(missing)}"
            )

    return True


def latest_route_rate(freight, origin, destination, vessel_type):
    subset = freight[
        (freight["origin"] == origin)
        & (freight["destination"] == destination)
        & (freight["vessel_type"] == vessel_type)
    ].sort_values("date")

    if subset.empty:
        return None

    return float(subset.iloc[-1]["freight_rate"])


def build_scenario_lookup(scenarios):
    if scenarios is None or scenarios.empty:
        return {}

    # The scenario file currently contains a route-specific forecast.
    # Store all available route/vessel-independent scenario curves here.
    # If route/vessel columns are not present, the curve is used as a
    # global stress adjustment.
    required = {
        "forecast_freight_rate",
        "low_scenario",
        "base_scenario",
        "high_scenario",
    }

    if not required.issubset(scenarios.columns):
        return {}

    result = {
        "global": {
            "low": float(scenarios["low_scenario"].mean()),
            "base": float(scenarios["base_scenario"].mean()),
            "high": float(scenarios["high_scenario"].mean()),
        }
    }

    return result


def scenario_rates(base_rate, scenario_lookup):
    """
    Convert the available scenario curve into route-relative multipliers.

    We do NOT assign probabilities to LOW/BASE/HIGH.

    If the exact route-specific scenario is unavailable, the global
    scenario ratios are applied to the latest route-specific market rate.
    This is explicitly a prototype stress-scenario approximation.
    """
    if not scenario_lookup or "global" not in scenario_lookup:
        return base_rate, base_rate, base_rate

    g = scenario_lookup["global"]

    if g["base"] <= 0:
        return base_rate, base_rate, base_rate

    low = base_rate * (g["low"] / g["base"])
    base = base_rate
    high = base_rate * (g["high"] / g["base"])

    return low, base, high


def route_sailing_days(voyages, origin, destination, vessel_type):
    subset = voyages[
        (voyages["origin"] == origin)
        & (voyages["destination"] == destination)
        & (voyages["vessel_type"] == vessel_type)
    ]

    if subset.empty:
        return None

    return float(subset.iloc[0]["estimated_sailing_days"])


def feasible_vessels_for_cargo(feasibility, cargo_id):
    f = feasibility[
        (feasibility["cargo_id"] == cargo_id)
        & (
            feasibility["feasible"].astype(str).str.upper().isin(
                ["TRUE", "1", "YES", "FEASIBLE"]
            )
        )
    ]

    return set(f["vessel_id"].astype(str))


def calculate_candidate(
    cargo,
    vessel,
    port,
    sailing_days,
    vessel_available_at,
    allocated_quantity,
    low_rate,
    base_rate,
    high_rate,
):
    # A voyage starts when both cargo and vessel are ready.
    start = max(cargo["earliest_arrival"], vessel_available_at)

    # Handling time is based on the actual allocated quantity.
    handling_days = (
        allocated_quantity / float(port["cargo_handling_rate_tph"]) / 24.0
    )

    arrival = start + pd.to_timedelta(
        sailing_days + handling_days,
        unit="D",
    )

    fuel_mt = (
        float(vessel["fuel_consumption_laden_mt_day"])
        * sailing_days
    )

    # The current market factor file contains the latest bunker price.
    # It is injected by the caller.
    return {
        "start": start,
        "arrival": arrival,
        "handling_days": handling_days,
        "fuel_mt": fuel_mt,
        "low_rate": low_rate,
        "base_rate": base_rate,
        "high_rate": high_rate,
    }


def choose_candidate(candidates):
    """
    Lexicographic decision:
      1. Prefer deadline-feasible voyages.
      2. Among those, minimize risk-adjusted objective.
      3. Then minimize completion time.
      4. Then minimize base cost.
    """
    feasible = [c for c in candidates if c["deadline_feasible"]]

    pool = feasible if feasible else candidates

    return min(
        pool,
        key=lambda x: (
            x["objective_cost"],
            x["arrival"],
            x["base_total_cost"],
        ),
    )


def optimize():
    (
        cargo,
        vessels,
        ports,
        voyages,
        freight,
        feasibility,
        scenarios,
    ) = load_inputs()

    validate_inputs(
        cargo, vessels, ports, voyages, freight, feasibility
    )

    scenario_lookup = build_scenario_lookup(scenarios)

    # Latest bunker price available in the market-factor file.
    market_path = RAW_DIR / "market_factors.csv"
    market = pd.read_csv(market_path)
    market["date"] = pd.to_datetime(market["date"])
    latest_market = market.sort_values("date").iloc[-1]
    bunker_price = float(latest_market["bunker_price_usd_per_mt"])

    # Each vessel has its own next-available timestamp.
    vessel_available = {
        row["vessel_id"]: pd.Timestamp.min
        for _, row in vessels.iterrows()
    }

    results = []

    # Tightest deadlines and high-priority cargo are handled first.
    cargo = cargo.copy()
    cargo["_priority_weight"] = (
        cargo["priority"]
        .astype(str)
        .str.upper()
        .map(PRIORITY_WEIGHT)
        .fillna(1)
    )

    cargo = cargo.sort_values(
        ["required_by", "_priority_weight", "quantity_tonnes"],
        ascending=[True, False, False],
    )

    for _, cargo_row in cargo.iterrows():
        cargo_id = cargo_row["cargo_id"]
        remaining = float(cargo_row["quantity_tonnes"])
        voyage_sequence = 1

        allowed_vessels = feasible_vessels_for_cargo(
            feasibility, cargo_id
        )

        if not allowed_vessels:
            continue

        while remaining > 1e-6:
            candidates = []

            for _, vessel in vessels.iterrows():
                vessel_id = vessel["vessel_id"]

                if str(vessel_id) not in allowed_vessels:
                    continue

                vessel_type = vessel["vessel_type"]

                # The current feasibility file already incorporates
                # vessel/port physical constraints.
                port_rows = ports[
                    ports["port_id"] == cargo_row["destination"]
                ]

                if port_rows.empty:
                    continue

                port = port_rows.iloc[0]

                sailing_days = route_sailing_days(
                    voyages,
                    cargo_row["origin"],
                    cargo_row["destination"],
                    vessel_type,
                )

                if sailing_days is None:
                    continue

                capacity = float(vessel["cargo_capacity_mt"])
                allocated = min(capacity, remaining)

                base_rate = latest_route_rate(
                    freight,
                    cargo_row["origin"],
                    cargo_row["destination"],
                    vessel_type,
                )

                if base_rate is None:
                    continue

                low_rate, base_rate, high_rate = scenario_rates(
                    base_rate, scenario_lookup
                )

                calc = calculate_candidate(
                    cargo_row,
                    vessel,
                    port,
                    sailing_days,
                    vessel_available[vessel_id],
                    allocated,
                    low_rate,
                    base_rate,
                    high_rate,
                )

                freight_low = allocated * low_rate
                freight_base = allocated * base_rate
                freight_high = allocated * high_rate
                fuel_cost = calc["fuel_mt"] * bunker_price

                total_low = freight_low + fuel_cost
                total_base = freight_base + fuel_cost
                total_high = freight_high + fuel_cost

                deadline = cargo_row["required_by"]
                lateness_days = max(
                    0.0,
                    (calc["arrival"] - deadline).total_seconds()
                    / 86400.0,
                )

                deadline_feasible = lateness_days <= 0

                # HIGH-vs-BASE exposure is a stress metric, not a
                # probability-weighted expected cost.
                high_exposure = max(0.0, total_high - total_base)

                objective = (
                    total_base
                    + RISK_LAMBDA * high_exposure
                    + DEADLINE_PENALTY_PER_DAY * lateness_days
                )

                utilization = allocated / capacity

                candidates.append({
                    "cargo_id": cargo_id,
                    "vessel_id": vessel_id,
                    "vessel_type": vessel_type,
                    "origin": cargo_row["origin"],
                    "destination": cargo_row["destination"],
                    "allocated_quantity_mt": allocated,
                    "capacity_mt": capacity,
                    "utilization_pct": utilization * 100.0,
                    "sailing_days": sailing_days,
                    "handling_days": calc["handling_days"],
                    "start": calc["start"],
                    "arrival": calc["arrival"],
                    "required_by": deadline,
                    "lateness_days": lateness_days,
                    "deadline_feasible": deadline_feasible,
                    "low_rate": low_rate,
                    "base_rate": base_rate,
                    "high_rate": high_rate,
                    "freight_cost_low": freight_low,
                    "freight_cost_base": freight_base,
                    "freight_cost_high": freight_high,
                    "fuel_mt": calc["fuel_mt"],
                    "fuel_cost": fuel_cost,
                    "total_cost_low": total_low,
                    "base_total_cost": total_base,
                    "total_cost_high": total_high,
                    "high_scenario_exposure": high_exposure,
                    "objective_cost": objective,
                    "bunker_price": bunker_price,
                    "voyage_sequence": voyage_sequence,
                    "priority": cargo_row["priority"],
                })

            if not candidates:
                # No feasible vessel/route remains for this cargo.
                break

            chosen = choose_candidate(candidates)

            results.append(chosen)

            remaining -= chosen["allocated_quantity_mt"]

            # The vessel is now occupied until this voyage completes.
            vessel_available[chosen["vessel_id"]] = chosen["arrival"]

            voyage_sequence += 1

    if not results:
        raise RuntimeError("No feasible voyage assignments were generated.")

    result_df = pd.DataFrame(results)

    # Cargo-level status.
    cargo_summary = (
        result_df.groupby("cargo_id", as_index=False)
        .agg(
            allocated_quantity_mt=("allocated_quantity_mt", "sum"),
            total_base_cost=("base_total_cost", "sum"),
            total_low_cost=("total_cost_low", "sum"),
            total_high_cost=("total_cost_high", "sum"),
            total_high_exposure=("high_scenario_exposure", "sum"),
            voyages=("voyage_sequence", "count"),
            final_arrival=("arrival", "max"),
        )
    )

    cargo_meta = cargo[
        [
            "cargo_id",
            "quantity_tonnes",
            "required_by",
            "priority",
        ]
    ].copy()

    cargo_summary = cargo_summary.merge(
        cargo_meta,
        on="cargo_id",
        how="left",
    )

    cargo_summary["quantity_fulfilled_pct"] = (
        cargo_summary["allocated_quantity_mt"]
        / cargo_summary["quantity_tonnes"]
        * 100.0
    )

    cargo_summary["deadline_feasible"] = (
        cargo_summary["final_arrival"]
        <= cargo_summary["required_by"]
    )

    cargo_summary["late_days"] = (
        (
            cargo_summary["final_arrival"]
            - cargo_summary["required_by"]
        ).dt.total_seconds()
        / 86400.0
    ).clip(lower=0)

    # Explainable reason codes.
    def reason(row):
        reasons = []

        if row["quantity_fulfilled_pct"] < 99.999:
            reasons.append("INSUFFICIENT_AVAILABLE_VESSEL_CAPACITY")

        if row["deadline_feasible"]:
            reasons.append("DEADLINE_SATISFIED")
        else:
            reasons.append("DEADLINE_MISSED")

        if row["total_high_exposure"] > 0:
            reasons.append("HIGH_SCENARIO_FREIGHT_EXPOSURE")

        if row["voyages"] > 1:
            reasons.append("MULTI_VOYAGE_ALLOCATION")

        return "|".join(reasons)

    cargo_summary["reason_codes"] = cargo_summary.apply(reason, axis=1)

    # Add cargo-level status back to every voyage row.
    result_df = result_df.merge(
        cargo_summary[
            [
                "cargo_id",
                "quantity_fulfilled_pct",
                "deadline_feasible",
                "late_days",
                "reason_codes",
            ]
        ],
        on="cargo_id",
        how="left",
        suffixes=("", "_cargo"),
    )

    result_df["optimization_status"] = "HEURISTIC_RISK_AWARE"

    # Useful ordering for CSV inspection.
    result_df = result_df.sort_values(
        ["cargo_id", "voyage_sequence"]
    )

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    result_df.to_csv(OUTPUT_FILE, index=False)
    cargo_summary.to_csv(SUMMARY_FILE, index=False)

    total_quantity = float(cargo["quantity_tonnes"].sum())
    allocated_quantity = float(
        result_df["allocated_quantity_mt"].sum()
    )

    print("=" * 70)
    print("SAIL CHARTER OPTIMIZER")
    print("Multi-Vessel Charter Allocation Engine")
    print("=" * 70)

    print("\nMODEL ASSUMPTIONS")
    print("-" * 70)
    print("Parallel vessels             : YES")
    print("Sequential use of same vessel: YES")
    print("Ballast/repositioning time    : NOT MODELED")
    print("Scenario probabilities        : NOT ASSIGNED")
    print(f"Risk lambda                   : {RISK_LAMBDA}")

    print("\nOPTIMIZATION RESULTS")
    print("-" * 70)
    print(f"Cargo requirements            : {len(cargo)}")
    print(f"Voyage assignments            : {len(result_df)}")
    print(f"Total cargo required          : {total_quantity:,.0f} mt")
    print(f"Total cargo allocated         : {allocated_quantity:,.0f} mt")
    print(
        f"Overall fulfillment           : "
        f"{allocated_quantity / total_quantity * 100:.2f}%"
    )
    print(
        f"Deadline-feasible cargoes    : "
        f"{int(cargo_summary['deadline_feasible'].sum())}"
        f"/{len(cargo_summary)}"
    )
    print(
        f"Total base cost              : "
        f"${result_df['base_total_cost'].sum():,.2f}"
    )
    print(
        f"Total HIGH-scenario exposure: "
        f"${result_df['high_scenario_exposure'].sum():,.2f}"
    )

    print("\nTOP ALLOCATIONS")
    print("-" * 70)

    display_cols = [
        "cargo_id",
        "vessel_id",
        "vessel_type",
        "allocated_quantity_mt",
        "voyage_sequence",
        "start",
        "arrival",
        "deadline_feasible",
        "base_total_cost",
        "high_scenario_exposure",
    ]

    print(
        result_df[display_cols]
        .head(15)
        .to_string(index=False)
    )

    print("\nOUTPUTS")
    print("-" * 70)
    print(OUTPUT_FILE)
    print(SUMMARY_FILE)

    print("\n" + "=" * 70)
    print("MULTI-VESSEL OPTIMIZATION COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    optimize()
