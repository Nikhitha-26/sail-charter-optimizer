import pandas as pd
import joblib

from data_loader import (
    load_freight_rates,
    load_market_factors
)

from features import create_forecasting_dataset


# ---------------------------------------------------------
# Load data
# ---------------------------------------------------------

freight_df = load_freight_rates()
market_df = load_market_factors()

print(f"Freight rows: {len(freight_df)}")
print(f"Market rows: {len(market_df)}")


# ---------------------------------------------------------
# Create forecasting dataset
# ---------------------------------------------------------

df = create_forecasting_dataset(
    freight_df,
    market_df
)

print(f"Final modelling dataset: {df.shape}")


# ---------------------------------------------------------
# Load trained model + preprocessor
# ---------------------------------------------------------

model = joblib.load(
    "models/freight_forecast_xgb.pkl"
)

preprocessor = joblib.load(
    "models/freight_preprocessor.pkl"
)


# ---------------------------------------------------------
# Feature definitions
# ---------------------------------------------------------

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


feature_columns = (
    numeric_features +
    categorical_features
)


# ---------------------------------------------------------
# Get transformed feature names
# ---------------------------------------------------------

feature_names = preprocessor.get_feature_names_out()

importance = model.feature_importances_


# ---------------------------------------------------------
# Verify dimensions
# ---------------------------------------------------------

print("\nFeature count check")
print("------------------")
print(
    "Transformed feature names:",
    len(feature_names)
)

print(
    "Feature importances:",
    len(importance)
)


if len(feature_names) != len(importance):

    raise ValueError(
        f"Feature mismatch: "
        f"{len(feature_names)} names vs "
        f"{len(importance)} importance values"
    )


# ---------------------------------------------------------
# Create feature importance dataframe
# ---------------------------------------------------------

importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": importance
})


importance_df = importance_df.sort_values(
    "importance",
    ascending=False
).reset_index(drop=True)


# ---------------------------------------------------------
# Clean transformer prefixes
# ---------------------------------------------------------

importance_df["feature"] = (
    importance_df["feature"]
    .str.replace("num__", "", regex=False)
    .str.replace("cat__", "", regex=False)
)


# ---------------------------------------------------------
# Display top 30
# ---------------------------------------------------------

print("\nTop 30 Feature Importances")
print("--------------------------")

print(
    importance_df.head(30).to_string(index=False)
)


# ---------------------------------------------------------
# Save results
# ---------------------------------------------------------

output_path = (
    "backend/data/processed/"
    "feature_importance.csv"
)

importance_df.to_csv(
    output_path,
    index=False
)


print("\nFeature importance saved successfully:")
print(output_path)