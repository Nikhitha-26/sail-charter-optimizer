import sys
from pathlib import Path

import pandas as pd
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error

from xgboost import XGBRegressor

sys.path.append(str(Path(__file__).resolve().parents[2]))

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

print("Freight rows:", len(freight))
print("Market rows:", len(market))


# ==========================================================
# 2. CREATE FEATURES
# ==========================================================

df = create_forecasting_dataset(
    freight,
    market
)

print("Final modelling dataset:", df.shape)


# ==========================================================
# 3. TIME-BASED SPLIT
# ==========================================================

df = df.sort_values("date")

train_end = pd.Timestamp("2025-12-31")
validation_end = pd.Timestamp("2026-06-30")

train_df = df[df["date"] <= train_end]

validation_df = df[
    (df["date"] > train_end) &
    (df["date"] <= validation_end)
]

test_df = df[
    df["date"] > validation_end
]

print("\nSplit:")
print("Train:", train_df.shape)
print("Validation:", validation_df.shape)
print("Test:", test_df.shape)


# ==========================================================
# 4. FEATURES
# ==========================================================

target = "freight_rate"

numeric_features = [
    # Freight history
    "freight_rate_lag_1",
    "freight_rate_lag_7",
    "freight_rate_lag_14",
    "freight_rate_lag_30",

    "rolling_mean_7",
    "rolling_mean_30",
    "rolling_std_30",

    # Current market conditions
    "coal_price_usd_per_mt",
    "bunker_price_usd_per_mt",
    "crude_price_usd_per_bbl",
    "port_congestion_index",
    "vessel_availability_index",

    # Coal
    "coal_price_usd_per_mt_lag_1",
    "coal_price_usd_per_mt_lag_7",
    "coal_price_usd_per_mt_lag_14",
    "coal_price_usd_per_mt_lag_30",
    "coal_price_usd_per_mt_change_7d",
    "coal_price_usd_per_mt_change_30d",

    # Bunker
    "bunker_price_usd_per_mt_lag_1",
    "bunker_price_usd_per_mt_lag_7",
    "bunker_price_usd_per_mt_lag_14",
    "bunker_price_usd_per_mt_lag_30",
    "bunker_price_usd_per_mt_change_7d",
    "bunker_price_usd_per_mt_change_30d",

    # Crude
    "crude_price_usd_per_bbl_lag_1",
    "crude_price_usd_per_bbl_lag_7",
    "crude_price_usd_per_bbl_lag_14",
    "crude_price_usd_per_bbl_lag_30",
    "crude_price_usd_per_bbl_change_7d",
    "crude_price_usd_per_bbl_change_30d",

    # Port congestion
    "port_congestion_index_lag_1",
    "port_congestion_index_lag_7",
    "port_congestion_index_lag_14",
    "port_congestion_index_lag_30",
    "port_congestion_index_change_7d",
    "port_congestion_index_change_30d",

    # Vessel availability
    "vessel_availability_index_lag_1",
    "vessel_availability_index_lag_7",
    "vessel_availability_index_lag_14",
    "vessel_availability_index_lag_30",
    "vessel_availability_index_change_7d",
    "vessel_availability_index_change_30d",

    # Calendar
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


X_train = train_df[
    numeric_features + categorical_features
]

y_train = train_df[target]

X_validation = validation_df[
    numeric_features + categorical_features
]

y_validation = validation_df[target]

X_test = test_df[
    numeric_features + categorical_features
]

y_test = test_df[target]


# ==========================================================
# 5. PREPROCESSING
# ==========================================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(
                handle_unknown="ignore"
            ),
            categorical_features
        ),

        (
            "numeric",
            "passthrough",
            numeric_features
        )
    ]
)


X_train_processed = preprocessor.fit_transform(X_train)

X_validation_processed = (
    preprocessor.transform(X_validation)
)

X_test_processed = (
    preprocessor.transform(X_test)
)


# ==========================================================
# 6. XGBOOST MODEL
# ==========================================================

model = XGBRegressor(
    n_estimators=500,
    learning_rate=0.05,
    max_depth=8,
    subsample=0.8,
    colsample_bytree=0.8,
    objective="reg:squarederror",
    random_state=42,
    n_jobs=-1
)


print("\nTraining model...")

model.fit(
    X_train_processed,
    y_train
)


# ==========================================================
# 7. VALIDATION
# ==========================================================

validation_predictions = model.predict(
    X_validation_processed
)

validation_mae = mean_absolute_error(
    y_validation,
    validation_predictions
)

validation_rmse = mean_squared_error(
    y_validation,
    validation_predictions
) ** 0.5


print("\nValidation Results")
print("------------------")
print("MAE :", validation_mae)
print("RMSE:", validation_rmse)


# ==========================================================
# 8. TEST
# ==========================================================

test_predictions = model.predict(
    X_test_processed
)

test_mae = mean_absolute_error(
    y_test,
    test_predictions
)

test_rmse = mean_squared_error(
    y_test,
    test_predictions
) ** 0.5


print("\nTest Results")
print("------------")
print("MAE :", test_mae)
print("RMSE:", test_rmse)


# ==========================================================
# 9. SAVE MODEL
# ==========================================================

models_dir = (
    Path(__file__).resolve().parents[2]
    / "models"
)

models_dir.mkdir(
    parents=True,
    exist_ok=True
)

joblib.dump(
    model,
    models_dir / "freight_forecast_xgb.pkl"
)

joblib.dump(
    preprocessor,
    models_dir / "freight_preprocessor.pkl"
)

print("\nModels saved successfully.")