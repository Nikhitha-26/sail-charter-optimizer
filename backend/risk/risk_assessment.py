from pathlib import Path
import pandas as pd
import numpy as np


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

RAW_DATA_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DATA_DIR = BASE_DIR / "data" / "processed"

PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# INPUT FILES
# ============================================================

VOYAGE_COST_FILE = (
    PROCESSED_DATA_DIR / "voyage_cost_estimates.csv"
)

SCENARIO_FILE = (
    PROCESSED_DATA_DIR / "freight_scenarios_90d.csv"
)

ERROR_FILE = (
    PROCESSED_DATA_DIR / "forecast_error_distribution.csv"
)


# ============================================================
# OUTPUT FILES
# ============================================================

RISK_SUMMARY_FILE = (
    PROCESSED_DATA_DIR / "risk_summary.csv"
)

VOYAGE_RISK_FILE = (
    PROCESSED_DATA_DIR / "voyage_risk_assessment.csv"
)


# ============================================================
# DATA LOADING
# ============================================================

def load_data():

    if not VOYAGE_COST_FILE.exists():
        raise FileNotFoundError(
            f"Missing voyage cost file:\n{VOYAGE_COST_FILE}"
        )

    if not SCENARIO_FILE.exists():
        raise FileNotFoundError(
            f"Missing scenario file:\n{SCENARIO_FILE}"
        )

    if not ERROR_FILE.exists():
        raise FileNotFoundError(
            f"Missing forecast error file:\n{ERROR_FILE}"
        )

    voyage_costs = pd.read_csv(VOYAGE_COST_FILE)

    scenarios = pd.read_csv(
        SCENARIO_FILE,
        parse_dates=["forecast_date"]
    )

    errors = pd.read_csv(ERROR_FILE)

    return voyage_costs, scenarios, errors


# ============================================================
# ERROR DISTRIBUTION
# ============================================================

def extract_error_statistics(errors):
    """
    Extract forecast-error statistics from
    forecast_error_distribution.csv.

    The uncertainty module stores the results as:

        statistic,value

    Example:
        MAE,1.3771
        RMSE,1.9247
        Mean Error,-0.5205
        Std Error,1.8531
        P10,-2.5372
        P50,-0.3896
        P90,1.5419
    """

    required_columns = {"statistic", "value"}

    if not required_columns.issubset(errors.columns):
        raise ValueError(
            "forecast_error_distribution.csv must contain "
            f"columns {required_columns}.\n"
            f"Columns found: {list(errors.columns)}"
        )

    stats = {}

    for _, row in errors.iterrows():

        key = str(row["statistic"]).strip().lower()

        value = pd.to_numeric(
            row["value"],
            errors="coerce"
        )

        if pd.notna(value):
            stats[key] = float(value)

    # --------------------------------------------------------
    # Helper for tolerant statistic-name matching
    # --------------------------------------------------------

    def get_stat(*names):

        for name in names:
            key = name.lower()

            if key in stats:
                return stats[key]

        return np.nan

    # --------------------------------------------------------
    # Extract required uncertainty statistics
    # --------------------------------------------------------

    p10 = get_stat(
        "p10",
        "10th percentile",
        "10%"
    )

    p50 = get_stat(
        "p50",
        "50th percentile",
        "50%"
    )

    p90 = get_stat(
        "p90",
        "90th percentile",
        "90%"
    )

    error_std = get_stat(
        "std_error",
        "std error",
        "error std",
        "forecast error std",
        "standard deviation",
        "stdev",
        "std"
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    missing = []

    if pd.isna(p10):
        missing.append("P10")

    if pd.isna(p50):
        missing.append("P50")

    if pd.isna(p90):
        missing.append("P90")

    if pd.isna(error_std):
        missing.append("Std Error")

    if missing:
        raise ValueError(
            "Missing required uncertainty statistics: "
            f"{missing}\n"
            f"Statistics found: {list(stats.keys())}"
        )

    return {
        "p10_error": p10,
        "p50_error": p50,
        "p90_error": p90,
        "forecast_error_std": error_std
    }


# ============================================================
# SCENARIO STATISTICS
# ============================================================

def calculate_scenario_statistics(scenarios):

    required = [
        "forecast_freight_rate",
        "low_scenario",
        "base_scenario",
        "high_scenario"
    ]

    missing = [
        col for col in required
        if col not in scenarios.columns
    ]

    if missing:
        raise ValueError(
            f"Missing scenario columns: {missing}"
        )

    scenario_stats = scenarios.copy()

    # --------------------------------------------------------
    # Absolute spread
    # --------------------------------------------------------

    scenario_stats["scenario_spread"] = (
        scenario_stats["high_scenario"]
        - scenario_stats["low_scenario"]
    )

    # --------------------------------------------------------
    # Spread relative to base
    # --------------------------------------------------------

    scenario_stats["scenario_spread_pct"] = np.where(
        scenario_stats["base_scenario"].abs() > 0,
        (
            scenario_stats["scenario_spread"]
            / scenario_stats["base_scenario"].abs()
        ) * 100,
        np.nan
    )

    # --------------------------------------------------------
    # Downside / upside relative to BASE
    #
    # From the procurement perspective:
    #
    # HIGH freight = adverse cost exposure
    # LOW freight  = favorable freight environment
    # --------------------------------------------------------

    scenario_stats["upside_from_low_pct"] = np.where(
        scenario_stats["base_scenario"].abs() > 0,
        (
            (
                scenario_stats["base_scenario"]
                - scenario_stats["low_scenario"]
            )
            / scenario_stats["base_scenario"].abs()
        ) * 100,
        np.nan
    )

    scenario_stats["downside_from_high_pct"] = np.where(
        scenario_stats["base_scenario"].abs() > 0,
        (
            (
                scenario_stats["high_scenario"]
                - scenario_stats["base_scenario"]
            )
            / scenario_stats["base_scenario"].abs()
        ) * 100,
        np.nan
    )

    return scenario_stats


# ============================================================
# MARKET RISK LEVEL
# ============================================================

def classify_market_risk(spread_pct):

    """
    Transparent prototype thresholds.

    These are NOT statistical probabilities.
    They are explainable prototype classification bands.
    """

    if pd.isna(spread_pct):
        return "UNKNOWN"

    if spread_pct <= 10:
        return "LOW"

    if spread_pct <= 20:
        return "MEDIUM"

    return "HIGH"


# ============================================================
# BUILD MARKET RISK SUMMARY
# ============================================================

def build_risk_summary(error_stats, scenario_stats):

    summary = pd.DataFrame([{
        "forecast_error_p10":
            error_stats["p10_error"],

        "forecast_error_p50":
            error_stats["p50_error"],

        "forecast_error_p90":
            error_stats["p90_error"],

        "forecast_error_std":
            error_stats["forecast_error_std"],

        "average_base_freight":
            scenario_stats["base_scenario"].mean(),

        "average_low_freight":
            scenario_stats["low_scenario"].mean(),

        "average_high_freight":
            scenario_stats["high_scenario"].mean(),

        "average_scenario_spread":
            scenario_stats["scenario_spread"].mean(),

        "average_scenario_spread_pct":
            scenario_stats["scenario_spread_pct"].mean(),

        "average_upside_from_low_pct":
            scenario_stats["upside_from_low_pct"].mean(),

        "average_downside_from_high_pct":
            scenario_stats["downside_from_high_pct"].mean(),

        "maximum_scenario_spread_pct":
            scenario_stats["scenario_spread_pct"].max(),

        "market_risk_level":
            classify_market_risk(
                scenario_stats["scenario_spread_pct"].mean()
            )
    }])

    return summary


# ============================================================
# VOYAGE-LEVEL RISK
# ============================================================

def build_voyage_risk(
    voyage_costs,
    error_stats,
    scenario_stats
):

    result = voyage_costs.copy()

    # --------------------------------------------------------
    # Global scenario uncertainty
    #
    # The current scenario generator represents forecast
    # uncertainty for the prototype forecast route.
    #
    # We convert this into relative uncertainty rather than
    # blindly applying the absolute dollar/tonne error to
    # every route.
    # --------------------------------------------------------

    average_spread_pct = (
        scenario_stats["scenario_spread_pct"].mean()
    )

    average_downside_pct = (
        scenario_stats["downside_from_high_pct"].mean()
    )

    average_upside_pct = (
        scenario_stats["upside_from_low_pct"].mean()
    )

    # --------------------------------------------------------
    # Base freight
    # --------------------------------------------------------

    if "freight_rate_usd_per_mt" in result.columns:

        base_rate_column = "freight_rate_usd_per_mt"

    elif "freight_rate" in result.columns:

        base_rate_column = "freight_rate"

    else:

        raise ValueError(
            "Voyage cost file does not contain a freight-rate "
            "column."
        )

    result["risk_base_freight_rate"] = result[
        base_rate_column
    ]

    # --------------------------------------------------------
    # Scenario-adjusted freight estimates
    #
    # These are uncertainty bands, not probability forecasts.
    # --------------------------------------------------------

    result["risk_low_freight_rate"] = (
        result["risk_base_freight_rate"]
        * (1 - average_upside_pct / 100)
    )

    result["risk_high_freight_rate"] = (
        result["risk_base_freight_rate"]
        * (1 + average_downside_pct / 100)
    )

    # --------------------------------------------------------
    # Scenario freight cost
    # --------------------------------------------------------

    if "cargo_quantity_mt" in result.columns:

        quantity_column = "cargo_quantity_mt"

    elif "quantity" in result.columns:

        quantity_column = "quantity"

    elif "quantity_tonnes" in result.columns:

        quantity_column = "quantity_tonnes"

    else:

        raise ValueError(
            "Voyage cost file does not contain cargo quantity."
        )

    result["risk_low_freight_cost"] = (
        result["risk_low_freight_rate"]
        * result[quantity_column]
    )

    result["risk_base_freight_cost"] = (
        result["risk_base_freight_rate"]
        * result[quantity_column]
    )

    result["risk_high_freight_cost"] = (
        result["risk_high_freight_rate"]
        * result[quantity_column]
    )

    # --------------------------------------------------------
    # Cost exposure
    # --------------------------------------------------------

    result["freight_downside_exposure_usd"] = (
        result["risk_high_freight_cost"]
        - result["risk_base_freight_cost"]
    )

    result["freight_upside_exposure_usd"] = (
        result["risk_base_freight_cost"]
        - result["risk_low_freight_cost"]
    )

    # --------------------------------------------------------
    # Total-cost exposure
    #
    # Fuel and operational costs are kept unchanged here.
    # Only freight-rate uncertainty is propagated.
    # --------------------------------------------------------

    if "total_cost_usd" in result.columns:

        base_total = result["total_cost_usd"]

        if "freight_cost_usd" in result.columns:
            base_freight_cost = result["freight_cost_usd"]
        else:
            base_freight_cost = result["risk_base_freight_cost"]

        non_freight_cost = (
            base_total - base_freight_cost
        )

        result["risk_low_total_cost_usd"] = (
            non_freight_cost
            + result["risk_low_freight_cost"]
        )

        result["risk_base_total_cost_usd"] = (
            non_freight_cost
            + result["risk_base_freight_cost"]
        )

        result["risk_high_total_cost_usd"] = (
            non_freight_cost
            + result["risk_high_freight_cost"]
        )

        result["total_cost_downside_exposure_usd"] = (
            result["risk_high_total_cost_usd"]
            - result["risk_base_total_cost_usd"]
        )

    # --------------------------------------------------------
    # Deadline risk
    # --------------------------------------------------------

    if "deadline_feasible" in result.columns:

        result["deadline_risk"] = np.where(
            result["deadline_feasible"].astype(bool),
            "LOW",
            "HIGH"
        )

    else:

        result["deadline_risk"] = "UNKNOWN"

    # --------------------------------------------------------
    # Market risk
    # --------------------------------------------------------

    result["market_risk_level"] = classify_market_risk(
        average_spread_pct
    )

    result["scenario_spread_pct"] = (
        average_spread_pct
    )

    result["forecast_error_std"] = (
        error_stats["forecast_error_std"]
    )

    # --------------------------------------------------------
    # Important:
    #
    # We do NOT combine all of these into an arbitrary
    # "risk score".
    # --------------------------------------------------------

    result["risk_interpretation"] = np.where(
        result["deadline_risk"] == "HIGH",
        "Market uncertainty combined with current sequential deadline exposure",
        "Market uncertainty within current feasibility assumptions"
    )

    return result


# ============================================================
# PRINT SUMMARY
# ============================================================

def print_summary(
    error_stats,
    scenario_stats,
    risk_summary,
    voyage_risk
):

    print()
    print("=" * 70)
    print("SAIL CHARTER OPTIMIZER")
    print("Risk Assessment Engine")
    print("=" * 70)

    print()
    print("FORECAST UNCERTAINTY")
    print("-" * 70)

    print(
        f"P10 forecast error : "
        f"{error_stats['p10_error']:.4f}"
    )

    print(
        f"P50 forecast error : "
        f"{error_stats['p50_error']:.4f}"
    )

    print(
        f"P90 forecast error : "
        f"{error_stats['p90_error']:.4f}"
    )

    print(
        f"Forecast error std  : "
        f"{error_stats['forecast_error_std']:.4f}"
    )

    print()
    print("MARKET SCENARIO RISK")
    print("-" * 70)

    summary_row = risk_summary.iloc[0]

    print(
        f"Average BASE freight : "
        f"${summary_row['average_base_freight']:.2f}/mt"
    )

    print(
        f"Average LOW freight  : "
        f"${summary_row['average_low_freight']:.2f}/mt"
    )

    print(
        f"Average HIGH freight : "
        f"${summary_row['average_high_freight']:.2f}/mt"
    )

    print(
        f"Scenario spread      : "
        f"${summary_row['average_scenario_spread']:.2f}/mt"
    )

    print(
        f"Scenario spread %    : "
        f"{summary_row['average_scenario_spread_pct']:.2f}%"
    )

    print(
        f"Upside from LOW      : "
        f"{summary_row['average_upside_from_low_pct']:.2f}%"
    )

    print(
        f"Downside from HIGH   : "
        f"{summary_row['average_downside_from_high_pct']:.2f}%"
    )

    print(
        f"Market risk level    : "
        f"{summary_row['market_risk_level']}"
    )

    print()
    print("VOYAGE RISK")
    print("-" * 70)

    print(
        f"Candidates assessed  : "
        f"{len(voyage_risk)}"
    )

    if "total_cost_downside_exposure_usd" in voyage_risk:

        print(
            f"Average cost downside: "
            f"${voyage_risk['total_cost_downside_exposure_usd'].mean():,.2f}"
        )

        print(
            f"Maximum cost downside: "
            f"${voyage_risk['total_cost_downside_exposure_usd'].max():,.2f}"
        )

    if "deadline_risk" in voyage_risk:

        print(
            "Deadline HIGH risk   : "
            f"{(voyage_risk['deadline_risk'] == 'HIGH').sum()}"
        )

    print()
    print("OUTPUTS")
    print("-" * 70)

    print(RISK_SUMMARY_FILE)
    print(VOYAGE_RISK_FILE)


# ============================================================
# MAIN
# ============================================================

def main():

    (
        voyage_costs,
        scenarios,
        errors
    ) = load_data()

    error_stats = extract_error_statistics(errors)

    scenario_stats = calculate_scenario_statistics(
        scenarios
    )

    risk_summary = build_risk_summary(
        error_stats,
        scenario_stats
    )

    voyage_risk = build_voyage_risk(
        voyage_costs,
        error_stats,
        scenario_stats
    )

    # --------------------------------------------------------
    # Save outputs
    # --------------------------------------------------------

    risk_summary.to_csv(
        RISK_SUMMARY_FILE,
        index=False
    )

    voyage_risk.to_csv(
        VOYAGE_RISK_FILE,
        index=False
    )

    print_summary(
        error_stats,
        scenario_stats,
        risk_summary,
        voyage_risk
    )

    print()
    print("=" * 70)
    print("RISK ASSESSMENT COMPLETED")
    print("=" * 70)


if __name__ == "__main__":
    main()