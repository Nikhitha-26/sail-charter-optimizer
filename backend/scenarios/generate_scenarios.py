"""backend/scenarios/generate_scenarios.py generate freight scenarios"""

import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]

FORECAST_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "newcastle_paradip_capesize_90d_forecast.csv"
)

ERROR_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "forecast_error_distribution.csv"
)

OUTPUT_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "freight_scenarios_90d.csv"
)


def generate_scenarios():

    forecast = pd.read_csv(FORECAST_PATH)
    errors = pd.read_csv(ERROR_PATH)

    error_values = dict(
        zip(errors["statistic"], errors["value"])
    )

    # Forecast error = actual - predicted
    p10 = error_values["P10"]
    p50 = error_values["P50"]
    p90 = error_values["P90"]

    # Use the forecast as the base case.
    forecast["base_forecast"] = forecast["forecast_freight_rate"]

    # Convert historical forecast errors into scenarios.
    forecast["low_scenario"] = (
        forecast["base_forecast"] + p10
    ).clip(lower=0)

    forecast["base_scenario"] = (
        forecast["base_forecast"] + p50
    ).clip(lower=0)

    forecast["high_scenario"] = (
        forecast["base_forecast"] + p90
    ).clip(lower=0)

    forecast["scenario_spread"] = (
        forecast["high_scenario"]
        - forecast["low_scenario"]
    )

    forecast.to_csv(OUTPUT_PATH, index=False)

    print("\n======================================")
    print("FREIGHT SCENARIO GENERATION")
    print("======================================")

    print(f"\nP10 error : {p10:.4f}")
    print(f"P50 error : {p50:.4f}")
    print(f"P90 error : {p90:.4f}")

    print("\nScenario interpretation:")
    print("LOW  = lower freight-rate outcome")
    print("BASE = central forecast")
    print("HIGH = higher freight-rate outcome")

    print("\nSample:")
    print(
        forecast[
            [
                "forecast_date",
                "forecast_freight_rate",
                "low_scenario",
                "base_scenario",
                "high_scenario",
            ]
        ].head(10).to_string(index=False)
    )

    print("\nSaved:")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    generate_scenarios()