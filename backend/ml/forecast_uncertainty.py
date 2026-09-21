import pandas as pd
import numpy as np
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]

PREDICTIONS_PATH = BASE_DIR / "data" / "processed" / "forecast_test_predictions.csv"
OUTPUT_PATH = BASE_DIR / "data" / "processed" / "forecast_error_distribution.csv"


def calculate_uncertainty():

    print("Loading forecast predictions...")

    df = pd.read_csv(PREDICTIONS_PATH)

    print(f"Rows: {len(df)}")
    print(f"Columns: {df.columns.tolist()}")

    # Actual and predicted freight rates
    actual = df["freight_rate"]
    predicted = df["predicted_rate"]

    # Forecast error
    df["error"] = actual - predicted
    df["absolute_error"] = df["error"].abs()

    # Basic metrics
    mae = df["absolute_error"].mean()
    rmse = np.sqrt((df["error"] ** 2).mean())

    mean_error = df["error"].mean()
    std_error = df["error"].std()

    # Error distribution
    percentiles = df["error"].quantile(
        [0.10, 0.25, 0.50, 0.75, 0.90]
    )

    print("\nForecast Error Statistics")
    print("-------------------------")
    print(f"MAE        : {mae:.4f}")
    print(f"RMSE       : {rmse:.4f}")
    print(f"Mean Error : {mean_error:.4f}")
    print(f"Std Error  : {std_error:.4f}")

    print("\nError Percentiles")
    print("-----------------")
    print(f"P10 : {percentiles.loc[0.10]:.4f}")
    print(f"P25 : {percentiles.loc[0.25]:.4f}")
    print(f"P50 : {percentiles.loc[0.50]:.4f}")
    print(f"P75 : {percentiles.loc[0.75]:.4f}")
    print(f"P90 : {percentiles.loc[0.90]:.4f}")

    # Save error distribution
    error_distribution = pd.DataFrame({
        "statistic": [
            "MAE",
            "RMSE",
            "mean_error",
            "std_error",
            "P10",
            "P25",
            "P50",
            "P75",
            "P90"
        ],
        "value": [
            mae,
            rmse,
            mean_error,
            std_error,
            percentiles.loc[0.10],
            percentiles.loc[0.25],
            percentiles.loc[0.50],
            percentiles.loc[0.75],
            percentiles.loc[0.90]
        ]
    })

    error_distribution.to_csv(OUTPUT_PATH, index=False)

    print("\nSaved:")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    calculate_uncertainty()