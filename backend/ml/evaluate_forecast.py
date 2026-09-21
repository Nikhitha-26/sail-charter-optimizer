import sys
from pathlib import Path

import joblib
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error
)

sys.path.append(
    str(Path(__file__).resolve().parents[2])
)

from backend.ml.data_loader import (
    load_freight_rates,
    load_market_factors
)

from backend.ml.features import (
    create_forecasting_dataset
)


# ==========================================================
# 1. LOAD DATA
# ==========================================================

freight = load_freight_rates()
market = load_market_factors()

df = create_forecasting_dataset(
    freight,
    market
)

df = df.sort_values("date")


# ==========================================================
# 2. TEST PERIOD
# ==========================================================

test_start = pd.Timestamp("2026-07-01")

test_df = df[
    df["date"] >= test_start
].copy()


# ==========================================================
# 3. LOAD MODEL
# ==========================================================

models_dir = (
    Path(__file__).resolve().parents[2]
    / "models"
)

model = joblib.load(
    models_dir / "freight_forecast_xgb.pkl"
)

preprocessor = joblib.load(
    models_dir / "freight_preprocessor.pkl"
)


# ==========================================================
# 4. FEATURES
# ==========================================================

numeric_features = [
    "freight_rate_lag_1",
    "freight_rate_lag_7",
    "freight_rate_lag_14",
    "freight_rate_lag_30",
    "rolling_mean_7",
    "rolling_mean_30",
    "rolling_std_30",

    "coal_price_usd_per_mt",
    "bunker_price_usd_per_mt",
    "crude_price_usd_per_bbl",
    "port_congestion_index",
    "vessel_availability_index",

    "coal_price_usd_per_mt_lag_1",
    "coal_price_usd_per_mt_lag_7",
    "coal_price_usd_per_mt_lag_14",
    "coal_price_usd_per_mt_lag_30",
    "coal_price_usd_per_mt_change_7d",
    "coal_price_usd_per_mt_change_30d",

    "bunker_price_usd_per_mt_lag_1",
    "bunker_price_usd_per_mt_lag_7",
    "bunker_price_usd_per_mt_lag_14",
    "bunker_price_usd_per_mt_lag_30",
    "bunker_price_usd_per_mt_change_7d",
    "bunker_price_usd_per_mt_change_30d",

    "crude_price_usd_per_bbl_lag_1",
    "crude_price_usd_per_bbl_lag_7",
    "crude_price_usd_per_bbl_lag_14",
    "crude_price_usd_per_bbl_lag_30",
    "crude_price_usd_per_bbl_change_7d",
    "crude_price_usd_per_bbl_change_30d",

    "port_congestion_index_lag_1",
    "port_congestion_index_lag_7",
    "port_congestion_index_lag_14",
    "port_congestion_index_lag_30",
    "port_congestion_index_change_7d",
    "port_congestion_index_change_30d",

    "vessel_availability_index_lag_1",
    "vessel_availability_index_lag_7",
    "vessel_availability_index_lag_14",
    "vessel_availability_index_lag_30",
    "vessel_availability_index_change_7d",
    "vessel_availability_index_change_30d",

    "month",
    "day_of_year",
    "quarter"
]
categorical_features = [
    "origin",
    "destination",
    "vessel_type",
    "commodity"
]

feature_columns = (
    numeric_features +
    categorical_features
)


X_test = test_df[feature_columns]

y_test = test_df["freight_rate"]


# ==========================================================
# 5. MODEL PREDICTION
# ==========================================================

X_test_processed = preprocessor.transform(
    X_test
)

predictions = model.predict(
    X_test_processed
)

test_df["predicted_rate"] = predictions


# ==========================================================
# 6. NAIVE BASELINE
# ==========================================================

test_df["baseline_prediction"] = (
    test_df["freight_rate_lag_1"]
)

baseline_mae = mean_absolute_error(
    y_test,
    test_df["baseline_prediction"]
)

baseline_rmse = mean_squared_error(
    y_test,
    test_df["baseline_prediction"]
) ** 0.5


model_mae = mean_absolute_error(
    y_test,
    predictions
)

model_rmse = mean_squared_error(
    y_test,
    predictions
) ** 0.5


# ==========================================================
# 7. RESULTS
# ==========================================================

print("\n======================================")
print("FORECAST MODEL EVALUATION")
print("======================================")

print("\nXGBoost")
print("--------------------------------------")
print(f"MAE :  {model_mae:.4f}")
print(f"RMSE:  {model_rmse:.4f}")

print("\nNaive Previous-Day Baseline")
print("--------------------------------------")
print(f"MAE :  {baseline_mae:.4f}")
print(f"RMSE:  {baseline_rmse:.4f}")


improvement = (
    (baseline_mae - model_mae)
    / baseline_mae
) * 100

print(
    f"\nMAE improvement over baseline: "
    f"{improvement:.2f}%"
)


# ==========================================================
# 8. SAVE PREDICTIONS
# ==========================================================

output_dir = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "processed"
)

output_dir.mkdir(
    parents=True,
    exist_ok=True
)

output_file = (
    output_dir /
    "forecast_test_predictions.csv"
)

test_df[
    [
        "date",
        "origin",
        "destination",
        "vessel_type",
        "freight_rate",
        "predicted_rate",
        "baseline_prediction"
    ]
].to_csv(
    output_file,
    index=False
)

print(
    f"\nPredictions saved to:\n"
    f"{output_file}"
)


# ==========================================================
# 9. SAMPLE PREDICTIONS
# ==========================================================

print("\nSample predictions:")
print(
    test_df[
        [
            "date",
            "origin",
            "destination",
            "vessel_type",
            "freight_rate",
            "predicted_rate"
        ]
    ].head(20).to_string(index=False)
)


# ==========================================================
# 10. PLOT ACTUAL VS PREDICTED
# ==========================================================

# Select one representative route/vessel combination
route = test_df[
    (test_df["origin"] == "Newcastle_Australia") &
    (test_df["destination"] == "Paradip") &
    (test_df["vessel_type"] == "Capesize")
].copy()

route = route.sort_values("date")

# Limit chart to recent observations
route = route.tail(90)

plt.figure(figsize=(14, 6))

plt.plot(
    route["date"],
    route["freight_rate"],
    label="Actual Freight Rate"
)

plt.plot(
    route["date"],
    route["predicted_rate"],
    label="Predicted Freight Rate"
)

plt.xlabel("Date")
plt.ylabel("Freight Rate (USD/MT)")
plt.title(
    "Actual vs Predicted Freight Rate\n"
    "Newcastle Australia → Paradip | Capesize"
)

plt.legend()
plt.xticks(rotation=45)
plt.tight_layout()

chart_file = (
    output_dir /
    "actual_vs_predicted.png"
)

plt.savefig(
    chart_file,
    dpi=150
)

plt.show()

print(
    f"\nChart saved to:\n"
    f"{chart_file}"
)