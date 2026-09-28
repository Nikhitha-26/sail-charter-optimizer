from pathlib import Path
from math import ceil
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

RAW_DATA_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DATA_DIR = BASE_DIR / "data" / "processed"

PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# CONFIGURATION
# ============================================================

# Used when a specific forecast rate is not yet available.
# The engine uses the latest historical freight rate for the
# matching origin / destination / vessel type.
#
# Later this will be replaced by LOW / BASE / HIGH forecast
# rates from the scenario engine.

FREIGHT_RATE_LOOKBACK_DAYS = None


# ============================================================
# DATA LOADING
# ============================================================

def load_data():
    """
    Load all datasets required for voyage economics.
    """

    cargo = pd.read_csv(
        RAW_DATA_DIR / "cargo_requirements.csv"
    )

    vessels = pd.read_csv(
        RAW_DATA_DIR / "vessels.csv"
    )

    ports = pd.read_csv(
        RAW_DATA_DIR / "ports.csv"
    )

    voyages = pd.read_csv(
        RAW_DATA_DIR / "voyages.csv"
    )

    freight = pd.read_csv(
        RAW_DATA_DIR / "freight_rates.csv"
    )

    market = pd.read_csv(
        RAW_DATA_DIR / "market_factors.csv"
    )

    feasibility_path = (
        PROCESSED_DATA_DIR /
        "vessel_port_feasibility.csv"
    )

    feasibility = pd.read_csv(feasibility_path)

    # Dates
    cargo["earliest_arrival"] = pd.to_datetime(
        cargo["earliest_arrival"]
    )

    cargo["required_by"] = pd.to_datetime(
        cargo["required_by"]
    )

    freight["date"] = pd.to_datetime(
        freight["date"]
    )

    market["date"] = pd.to_datetime(
        market["date"]
    )

    return (
        cargo,
        vessels,
        ports,
        voyages,
        freight,
        market,
        feasibility,
    )


# ============================================================
# SCHEMA VALIDATION
# ============================================================

def validate_columns(df, required_columns, name):
    """
    Make sure a dataset contains the columns required
    by the voyage calculator.
    """

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"{name} is missing columns: {missing}\n"
            f"Available columns: {df.columns.tolist()}"
        )


def validate_inputs(
    cargo,
    vessels,
    ports,
    voyages,
    freight,
    market,
    feasibility,
):

    validate_columns(
        cargo,
        [
            "cargo_id",
            "commodity",
            "quantity_tonnes",
            "origin",
            "destination",
            "earliest_arrival",
            "required_by",
            "priority",
        ],
        "cargo_requirements.csv",
    )

    validate_columns(
        vessels,
        [
            "vessel_id",
            "vessel_type",
            "cargo_capacity_mt",
            "speed_knots",
            "fuel_consumption_laden_mt_day",
        ],
        "vessels.csv",
    )

    validate_columns(
        ports,
        [
            "port_id",
            "cargo_handling_rate_tph",
            "baseline_congestion_index",
        ],
        "ports.csv",
    )

    validate_columns(
        voyages,
        [
            "voyage_id",
            "origin",
            "destination",
            "vessel_type",
            "distance_nm",
            "estimated_sailing_days",
        ],
        "voyages.csv",
    )

    validate_columns(
        freight,
        [
            "date",
            "origin",
            "destination",
            "vessel_type",
            "freight_rate",
        ],
        "freight_rates.csv",
    )

    validate_columns(
        market,
        [
            "date",
            "bunker_price_usd_per_mt",
        ],
        "market_factors.csv",
    )

    print("Input schema validation: PASSED")


# ============================================================
# FREIGHT RATE
# ============================================================

def get_latest_freight_rate(
    freight,
    origin,
    destination,
    vessel_type,
):
    """
    Return the latest historical freight rate for
    a specific route and vessel type.

    This is intentionally separated from forecasting.
    Later the optimizer can replace this with BASE / LOW / HIGH
    forecast rates.
    """

    matches = freight[
        (freight["origin"] == origin)
        & (freight["destination"] == destination)
        & (freight["vessel_type"] == vessel_type)
    ].copy()

    if matches.empty:
        return None, None

    matches = matches.sort_values("date")

    latest = matches.iloc[-1]

    return (
        float(latest["freight_rate"]),
        latest["date"],
    )


# ============================================================
# MARKET PRICE
# ============================================================

def get_latest_bunker_price(market):
    """
    Use the latest available bunker price.

    This is a prototype assumption. Later the scenario engine
    can provide future bunker-price assumptions.
    """

    market = market.sort_values("date")

    latest = market.iloc[-1]

    return (
        float(latest["bunker_price_usd_per_mt"]),
        latest["date"],
    )


# ============================================================
# VOYAGE ROUTE
# ============================================================

def get_route(
    voyages,
    origin,
    destination,
    vessel_type,
):
    """
    Find the route corresponding to a cargo and vessel.
    """

    matches = voyages[
        (voyages["origin"] == origin)
        & (voyages["destination"] == destination)
        & (voyages["vessel_type"] == vessel_type)
    ]

    if matches.empty:
        return None

    return matches.iloc[0]


# ============================================================
# MAIN CALCULATION
# ============================================================

def calculate_voyage_costs(
    cargo,
    vessels,
    ports,
    voyages,
    freight,
    market,
    feasibility,
):
    """
    Calculate voyage-level and cargo-level economics.

    Only combinations marked feasible by the constraint
    engine are considered.
    """

    bunker_price, bunker_date = get_latest_bunker_price(
        market
    )

    results = []

    # --------------------------------------------------------
    # Identify feasibility columns
    # --------------------------------------------------------

    required_feasibility_columns = [
        "cargo_id",
        "vessel_id",
        "feasible",
    ]

    validate_columns(
        feasibility,
        required_feasibility_columns,
        "vessel_port_feasibility.csv",
    )

    feasible_pairs = feasibility[
        feasibility["feasible"].astype(str).str.upper()
        == "TRUE"
    ].copy()

    print(
        f"Feasible combinations received: "
        f"{len(feasible_pairs)}"
    )

    # --------------------------------------------------------
    # Iterate over feasible cargo-vessel combinations
    # --------------------------------------------------------

    for _, pair in feasible_pairs.iterrows():

        cargo_id = pair["cargo_id"]
        vessel_id = pair["vessel_id"]

        cargo_rows = cargo[
            cargo["cargo_id"] == cargo_id
        ]

        vessel_rows = vessels[
            vessels["vessel_id"] == vessel_id
        ]

        if cargo_rows.empty or vessel_rows.empty:
            continue

        cargo_row = cargo_rows.iloc[0]
        vessel_row = vessel_rows.iloc[0]

        origin = cargo_row["origin"]
        destination = cargo_row["destination"]

        vessel_type = vessel_row["vessel_type"]

        # ----------------------------------------------------
        # Route
        # ----------------------------------------------------

        route = get_route(
            voyages,
            origin,
            destination,
            vessel_type,
        )

        if route is None:
            results.append({
                "cargo_id": cargo_id,
                "vessel_id": vessel_id,
                "vessel_type": vessel_type,
                "origin": origin,
                "destination": destination,
                "status": "NO_ROUTE",
            })

            continue

        # ----------------------------------------------------
        # Basic quantities
        # ----------------------------------------------------

        quantity = float(
            cargo_row["quantity_tonnes"]
        )

        vessel_capacity = float(
            vessel_row["cargo_capacity_mt"]
        )

        sailing_days = float(
            route["estimated_sailing_days"]
        )

        distance_nm = float(
            route["distance_nm"]
        )

        fuel_per_day = float(
            vessel_row[
                "fuel_consumption_laden_mt_day"
            ]
        )

        # ----------------------------------------------------
        # Required voyages
        # ----------------------------------------------------

        required_voyages = ceil(
            quantity / vessel_capacity
        )

        # ----------------------------------------------------
        # Freight rate
        # ----------------------------------------------------

        freight_rate, freight_rate_date = (
            get_latest_freight_rate(
                freight,
                origin,
                destination,
                vessel_type,
            )
        )

        if freight_rate is None:

            results.append({
                "cargo_id": cargo_id,
                "vessel_id": vessel_id,
                "vessel_type": vessel_type,
                "origin": origin,
                "destination": destination,
                "status": "NO_FREIGHT_RATE",
            })

            continue

        # ----------------------------------------------------
        # Port information
        # ----------------------------------------------------

        port_rows = ports[
            ports["port_id"] == destination
        ]

        if port_rows.empty:

            results.append({
                "cargo_id": cargo_id,
                "vessel_id": vessel_id,
                "vessel_type": vessel_type,
                "origin": origin,
                "destination": destination,
                "status": "NO_PORT_DATA",
            })

            continue

        port = port_rows.iloc[0]

        handling_rate = float(
            port["cargo_handling_rate_tph"]
        )

        congestion_index = float(
            port["baseline_congestion_index"]
        )

        # ----------------------------------------------------
        # Cargo handling
        # ----------------------------------------------------

        total_handling_hours = (
            quantity / handling_rate
        )

        total_handling_days = (
            total_handling_hours / 24
        )

        # ----------------------------------------------------
        # Sailing time
        # ----------------------------------------------------

        total_sailing_days = (
            sailing_days * required_voyages
        )

        # ----------------------------------------------------
        # Total operational time
        # ----------------------------------------------------

        total_operational_days = (
            total_sailing_days
            + total_handling_days
        )

        # ----------------------------------------------------
        # Fuel consumption
        # ----------------------------------------------------

        fuel_per_voyage = (
            sailing_days
            * fuel_per_day
        )

        total_fuel_consumption = (
            fuel_per_voyage
            * required_voyages
        )

        # ----------------------------------------------------
        # Fuel cost
        # ----------------------------------------------------

        total_fuel_cost = (
            total_fuel_consumption
            * bunker_price
        )

        # ----------------------------------------------------
        # Freight cost
        # ----------------------------------------------------

        total_freight_cost = (
            quantity
            * freight_rate
        )

        # ----------------------------------------------------
        # Total voyage cost
        # ----------------------------------------------------

        total_cost = (
            total_freight_cost
            + total_fuel_cost
        )

        # ----------------------------------------------------
        # Cost per tonne
        # ----------------------------------------------------

        cost_per_tonne = (
            total_cost / quantity
            if quantity > 0
            else 0
        )

        # ----------------------------------------------------
        # Timing
        # ----------------------------------------------------

        earliest_arrival = pd.Timestamp(
            cargo_row["earliest_arrival"]
        )

        required_by = pd.Timestamp(
            cargo_row["required_by"]
        )

        estimated_arrival = (
            earliest_arrival
            + pd.Timedelta(
                days=total_operational_days
            )
        )

        deadline_days_margin = (
            required_by
            - estimated_arrival
        ).total_seconds() / 86400

        deadline_feasible = (
            estimated_arrival <= required_by
        )

        # ----------------------------------------------------
        # Capacity utilization
        # ----------------------------------------------------

        capacity_used = (
            quantity
            / (
                required_voyages
                * vessel_capacity
            )
            * 100
        )

        # ----------------------------------------------------
        # Store result
        # ----------------------------------------------------

        results.append({

            "cargo_id": cargo_id,

            "commodity": cargo_row["commodity"],

            "priority": cargo_row["priority"],

            "origin": origin,

            "destination": destination,

            "vessel_id": vessel_id,

            "vessel_type": vessel_type,

            "cargo_quantity_mt": quantity,

            "vessel_capacity_mt": vessel_capacity,

            "capacity_utilization_pct":
                round(capacity_used, 2),

            "required_voyages":
                required_voyages,

            "distance_nm":
                distance_nm,

            "sailing_days_per_voyage":
                round(sailing_days, 2),

            "total_sailing_days":
                round(total_sailing_days, 2),

            "cargo_handling_rate_tph":
                handling_rate,

            "total_handling_days":
                round(total_handling_days, 2),

            "total_operational_days":
                round(total_operational_days, 2),

            "fuel_consumption_mt_per_day":
                fuel_per_day,

            "fuel_consumption_mt_per_voyage":
                round(fuel_per_voyage, 2),

            "total_fuel_consumption_mt":
                round(total_fuel_consumption, 2),

            "bunker_price_usd_per_mt":
                round(bunker_price, 2),

            "total_fuel_cost_usd":
                round(total_fuel_cost, 2),

            "freight_rate_usd_per_mt":
                round(freight_rate, 4),

            "freight_rate_date":
                freight_rate_date,

            "total_freight_cost_usd":
                round(total_freight_cost, 2),

            "total_cost_usd":
                round(total_cost, 2),

            "total_cost_usd_per_mt":
                round(cost_per_tonne, 4),

            "earliest_arrival":
                earliest_arrival,

            "estimated_arrival":
                estimated_arrival,

            "required_by":
                required_by,

            "deadline_days_margin":
                round(deadline_days_margin, 2),

            "deadline_feasible":
                deadline_feasible,

            "port_congestion_index":
                congestion_index,

            "bunker_price_date":
                bunker_date,

            "status":
                "CALCULATED",
        })

    return pd.DataFrame(results)


# ============================================================
# SUMMARY
# ============================================================

def print_summary(results):

    print()
    print("=" * 70)
    print("VOYAGE FEASIBILITY + COST ANALYSIS")
    print("=" * 70)

    if results.empty:
        print("No results generated.")
        return

    calculated = results[
        results["status"] == "CALCULATED"
    ]

    print(
        f"Total feasible combinations : "
        f"{len(calculated)}"
    )

    print(
        f"Deadline feasible            : "
        f"{calculated['deadline_feasible'].sum()}"
    )

    print(
        f"Deadline infeasible          : "
        f"{(~calculated['deadline_feasible']).sum()}"
    )

    print()

    print(
        "Average cost / tonne         : "
        f"${calculated['total_cost_usd_per_mt'].mean():,.2f}"
    )

    print(
        "Minimum cost / tonne         : "
        f"${calculated['total_cost_usd_per_mt'].min():,.2f}"
    )

    print(
        "Maximum cost / tonne         : "
        f"${calculated['total_cost_usd_per_mt'].max():,.2f}"
    )

    print()

    print("Top 10 lowest-cost feasible combinations:")
    print("-" * 70)

    display_columns = [
        "cargo_id",
        "vessel_id",
        "vessel_type",
        "destination",
        "required_voyages",
        "total_cost_usd",
        "total_cost_usd_per_mt",
        "estimated_arrival",
        "deadline_feasible",
    ]

    print(
        calculated
        .sort_values("total_cost_usd_per_mt")
        [display_columns]
        .head(10)
        .to_string(index=False)
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("SAIL CHARTER OPTIMIZER")
    print("Voyage Feasibility + Cost Engine")
    print("=" * 70)

    (
        cargo,
        vessels,
        ports,
        voyages,
        freight,
        market,
        feasibility,
    ) = load_data()

    print()
    print("Loaded datasets:")
    print(
        f"Cargo requirements : {len(cargo)}"
    )
    print(
        f"Vessels            : {len(vessels)}"
    )
    print(
        f"Ports              : {len(ports)}"
    )
    print(
        f"Routes             : {len(voyages)}"
    )
    print(
        f"Freight records    : {len(freight)}"
    )
    print(
        f"Market records     : {len(market)}"
    )
    print(
        f"Feasibility rows   : {len(feasibility)}"
    )

    print()

    validate_inputs(
        cargo,
        vessels,
        ports,
        voyages,
        freight,
        market,
        feasibility,
    )

    results = calculate_voyage_costs(
        cargo,
        vessels,
        ports,
        voyages,
        freight,
        market,
        feasibility,
    )

    output_path = (
        PROCESSED_DATA_DIR /
        "voyage_cost_estimates.csv"
    )

    results.to_csv(
        output_path,
        index=False,
    )

    print_summary(results)

    print()
    print("=" * 70)
    print("OUTPUT SAVED")
    print("=" * 70)

    print(output_path)


if __name__ == "__main__":
    main()