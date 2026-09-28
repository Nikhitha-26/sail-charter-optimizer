from pathlib import Path
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parents[1]
PROCESSED = BASE_DIR / "data" / "processed"
RAW = BASE_DIR / "data" / "raw"


def load_csv(name, required=True):
    path = PROCESSED / name
    if not path.exists():
        path = RAW / name
    if not path.exists():
        if required:
            raise FileNotFoundError(f"Missing required file: {path}")
        return pd.DataFrame()
    return pd.read_csv(path)


def pct(x):
    return round(float(x) * 100, 2)


def first_col(df, *names):
    for name in names:
        if name in df.columns:
            return name
    return None


def main():
    risk = load_csv("risk_summary.csv").iloc[0]
    opt = load_csv("charter_optimization_results.csv")
    opt_summary = load_csv("charter_optimization_summary.csv", required=False)
    contracts = load_csv("contract_options.csv")

    # Forecast/scenario inputs
    base = float(risk["average_base_freight"])
    low = float(risk["average_low_freight"])
    high = float(risk["average_high_freight"])
    spread_pct = float(risk["average_scenario_spread_pct"])
    risk_level = str(risk["market_risk_level"])

    # Cargo-level fields live on charter_optimization_summary.csv
    # (one row per cargo). Voyage rows would double-count required quantity.
    cargo_src = opt_summary if len(opt_summary) else opt

    required_col = first_col(
        cargo_src,
        "quantity_tonnes",
        "required_quantity_mt",
        "cargo_quantity_mt",
    )
    allocated_col = first_col(cargo_src, "allocated_quantity_mt")
    cost_col = first_col(opt, "base_total_cost", "base_cost_usd", "total_cost_usd")
    exposure_col = first_col(
        opt,
        "high_scenario_exposure",
        "high_scenario_cost_usd",
        "total_high_exposure",
    )

    total_required = float(cargo_src[required_col].sum()) if required_col else 0
    total_allocated = float(cargo_src[allocated_col].sum()) if allocated_col else 0
    total_base_cost = float(opt[cost_col].sum()) if cost_col else 0
    high_exposure = float(opt[exposure_col].sum()) if exposure_col else 0

    shortage = max(total_required - total_allocated, 0)
    fulfillment = (total_allocated / total_required * 100) if total_required else 0

    # Cargo-level deadline status
    deadline_col = first_col(cargo_src, "deadline_feasible")
    if "cargo_id" in cargo_src.columns and deadline_col:
        if allocated_col:
            cargo = cargo_src.groupby("cargo_id").agg(
                allocated=(allocated_col, "sum"),
                deadline_feasible=(deadline_col, "all"),
            ).reset_index()
        else:
            cargo = cargo_src.groupby("cargo_id").agg(
                deadline_feasible=(deadline_col, "all"),
            ).reset_index()
        deadline_infeasible = int((~cargo["deadline_feasible"]).sum())
    else:
        deadline_infeasible = 0

    # Contract comparison: use documented contract fields only.
    # Lower premium/discount is not automatically "better"; the engine reports
    # the available terms and chooses a strategy based on risk + duration.
    contract_rows = []
    for _, r in contracts.iterrows():
        contract_rows.append({
            "contract_id": r["contract_id"],
            "contract_type": r["contract_type"],
            "duration_months": int(r["duration_months"]),
            "min_quantity_mt": float(r["min_quantity_mt"]),
            "max_quantity_mt": float(r["max_quantity_mt"]),
            "rate_adjustment": float(r["rate_premium_discount"]),
            "availability": r["availability"],
        })
    contract_df = pd.DataFrame(contract_rows)

    # Prototype decision policy:
    # - high market risk -> avoid committing the full requirement long-term
    # - medium risk -> balance medium-term coverage with flexibility
    # - low risk -> longer coverage can be considered
    if risk_level.upper() == "HIGH":
        strategy = "SHORT_TERM / STAGED MULTI-VOYAGE"
        duration = 3
        reason = "High scenario uncertainty favors staged procurement and flexibility."
    elif risk_level.upper() == "MEDIUM":
        strategy = "MEDIUM_TERM / MULTI-VOYAGE"
        duration = 6
        reason = "Moderate scenario spread supports multi-voyage coverage while retaining flexibility."
    else:
        strategy = "MEDIUM_TERM / MULTI-VOYAGE"
        duration = 6
        reason = "Lower scenario uncertainty permits longer planned coverage."

    # Find matching contract terms, if available.
    matching = contract_df[contract_df["duration_months"] == duration]
    if len(matching):
        selected_contract = matching.iloc[0].to_dict()
    else:
        selected_contract = contract_df.iloc[0].to_dict() if len(contract_df) else {}

    # Vessel mix
    vessel_qty_col = first_col(opt, "allocated_quantity_mt")
    if "vessel_type" in opt.columns and vessel_qty_col and len(opt):
        vessel_mix = (
            opt.groupby("vessel_type")[vessel_qty_col]
            .sum()
            .sort_values(ascending=False)
            .to_dict()
        )
        vessel_types = list(vessel_mix.keys())
    else:
        vessel_mix = {}
        vessel_types = []

    # Explainable signals
    explanations = [
        f"Base freight scenario is ${base:.2f}/MT, with LOW ${low:.2f}/MT and HIGH ${high:.2f}/MT.",
        f"Scenario spread is {spread_pct:.2f}%, classified as {risk_level} market risk.",
        f"The allocation covers {fulfillment:.2f}% of the modeled cargo requirement.",
        f"{deadline_infeasible} cargo requirements have at least one deadline-feasibility issue in the current schedule.",
    ]
    if vessel_types:
        explanations.append(
            "The allocation uses feasible vessel types: " + ", ".join(vessel_types) + "."
        )
    if shortage > 0:
        explanations.append(
            f"Current vessel/schedule assumptions leave {shortage:,.0f} MT unallocated; this is reported as a planning constraint rather than hidden."
        )

    output = {
        "decision": {
            "strategy": strategy,
            "contract_duration_months": duration,
            "contract_terms": selected_contract,
            "reason": reason,
        },
        "market": {
            "base_freight_usd_per_mt": round(base, 2),
            "low_freight_usd_per_mt": round(low, 2),
            "high_freight_usd_per_mt": round(high, 2),
            "scenario_spread_pct": round(spread_pct, 2),
            "risk_level": risk_level,
        },
        "optimization": {
            "total_required_mt": round(total_required, 0),
            "total_allocated_mt": round(total_allocated, 0),
            "shortage_mt": round(shortage, 0),
            "fulfillment_pct": round(fulfillment, 2),
            "total_base_cost_usd": round(total_base_cost, 2),
            "high_scenario_exposure_usd": round(high_exposure, 2),
            "deadline_infeasible_cargoes": deadline_infeasible,
            "vessel_mix": vessel_mix,
        },
        "explanations": explanations,
    }

    # Save machine-readable decision output
    out_json = PROCESSED / "charter_decision.json"
    import json
    out_json.write_text(json.dumps(output, indent=2, default=str), encoding="utf-8")

    # Save a compact CSV for the frontend
    summary = pd.DataFrame([{
        "strategy": strategy,
        "contract_duration_months": duration,
        "risk_level": risk_level,
        "base_freight_usd_per_mt": base,
        "low_freight_usd_per_mt": low,
        "high_freight_usd_per_mt": high,
        "scenario_spread_pct": spread_pct,
        "total_required_mt": total_required,
        "total_allocated_mt": total_allocated,
        "shortage_mt": shortage,
        "fulfillment_pct": fulfillment,
        "total_base_cost_usd": total_base_cost,
        "high_scenario_exposure_usd": high_exposure,
        "deadline_infeasible_cargoes": deadline_infeasible,
        "vessel_types": ", ".join(vessel_types),
    }])
    summary.to_csv(PROCESSED / "charter_decision_summary.csv", index=False)

    print("\nSAIL CHARTER DECISION ENGINE")
    print("=" * 55)
    print(f"Strategy                 : {strategy}")
    print(f"Contract duration        : {duration} months")
    print(f"Market risk              : {risk_level}")
    print(f"Base freight             : ${base:.2f}/MT")
    print(f"LOW / HIGH               : ${low:.2f} / ${high:.2f} per MT")
    print(f"Scenario spread          : {spread_pct:.2f}%")
    print(f"Cargo fulfillment        : {fulfillment:.2f}%")
    print(f"Shortage                 : {shortage:,.0f} MT")
    print(f"Base cost                : ${total_base_cost:,.2f}")
    print(f"High-scenario exposure   : ${high_exposure:,.2f}")
    print(f"Deadline-infeasible      : {deadline_infeasible} cargoes")
    print(f"Vessel types             : {', '.join(vessel_types) if vessel_types else 'N/A'}")
    print("\nWhy:")
    for x in explanations:
        print(f" - {x}")
    print(f"\nSaved: {out_json}")
    print(f"Saved: {PROCESSED / 'charter_decision_summary.csv'}")


if __name__ == "__main__":
    main()
