"""backend/ml/multi_horizon_forecast.py multi-horizon forecast model"""

import pandas as pd
import numpy as np
import joblib

try:
    from .data_loader import (
        load_freight_rates,
        load_market_factors,
    )
    from .features import create_forecasting_dataset
except ImportError:
    from data_loader import (
        load_freight_rates,
        load_market_factors,
    )
    from features import create_forecasting_dataset


# =========================================================
# Configuration
# =========================================================

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "freight_forecast_xgb.pkl"
)

PREPROCESSOR_PATH = (
    PROJECT_ROOT
    / "models"
    / "freight_preprocessor.pkl"
)

FORECAST_HORIZONS = [7, 30, 90]


GROUP_COLUMNS = [
    "origin",
    "destination",
    "vessel_type"
]


NUMERIC_FEATURES = [

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


CATEGORICAL_FEATURES = [
    "origin",
    "destination",
    "vessel_type",
    "commodity"
]


FEATURE_COLUMNS = (
    NUMERIC_FEATURES +
    CATEGORICAL_FEATURES
)


# =========================================================
# Load model
# =========================================================

print("Loading model...")

model = joblib.load(MODEL_PATH)
preprocessor = joblib.load(PREPROCESSOR_PATH)

print("Model loaded successfully.")


# =========================================================
# Load data
# =========================================================

print("\nLoading data...")

freight_df = load_freight_rates()
market_df = load_market_factors()

print(f"Freight rows: {len(freight_df)}")
print(f"Market rows: {len(market_df)}")


# =========================================================
# Prepare historical forecasting dataset
# =========================================================

historical_df = create_forecasting_dataset(
    freight_df,
    market_df
)

historical_df = historical_df.sort_values(
    ["origin", "destination", "vessel_type", "date"]
).reset_index(drop=True)


# =========================================================
# Latest available market conditions
# =========================================================

latest_market = (
    market_df
    .sort_values("date")
    .iloc[-1]
)


# =========================================================
# Forecast function
# =========================================================

def forecast_route(
    history,
    origin,
    destination,
    vessel_type,
    commodity,
    horizon=90
):
    """
    Generate recursive daily freight forecasts
    for one origin-destination-vessel combination.
    """

    route_history = history[
        (history["origin"] == origin)
        & (history["destination"] == destination)
        & (history["vessel_type"] == vessel_type)
    ].copy()

    route_history = route_history.sort_values("date")

    if len(route_history) < 40:
        raise ValueError(
            "Not enough historical observations "
            f"for {origin} -> {destination} "
            f"{vessel_type}"
        )

    # -----------------------------------------------------
    # Historical freight values
    # -----------------------------------------------------

    freight_history = list(
        route_history["freight_rate"].tail(30)
    )

    last_date = route_history["date"].max()

    forecasts = []

    # -----------------------------------------------------
    # Recursive forecasting
    # -----------------------------------------------------

    for step in range(1, horizon + 1):

        forecast_date = (
            last_date +
            pd.Timedelta(days=step)
        )

        # ---------------------------------------------
        # Freight lag values
        # ---------------------------------------------

        lag_1 = freight_history[-1]
        lag_7 = freight_history[-7]
        lag_14 = freight_history[-14]
        lag_30 = freight_history[-30]

        rolling_mean_7 = np.mean(
            freight_history[-7:]
        )

        rolling_mean_30 = np.mean(
            freight_history[-30:]
        )

        rolling_std_30 = np.std(
            freight_history[-30:]
        )

        # ---------------------------------------------
        # Market values
        #
        # V1 of the future forecasting engine assumes
        # market conditions remain at their latest
        # observed values.
        # ---------------------------------------------

        market_values = {}

        for feature in [
            "coal_price_usd_per_mt",
            "bunker_price_usd_per_mt",
            "crude_price_usd_per_bbl",
            "port_congestion_index",
            "vessel_availability_index"
        ]:
            market_values[feature] = latest_market[feature]

        # ---------------------------------------------
        # Construct market lag/change features
        #
        # Under persistence assumption, all future
        # lagged values equal the latest value and
        # future changes become zero.
        # ---------------------------------------------

        row = {

            "freight_rate_lag_1": lag_1,
            "freight_rate_lag_7": lag_7,
            "freight_rate_lag_14": lag_14,
            "freight_rate_lag_30": lag_30,

            "rolling_mean_7": rolling_mean_7,
            "rolling_mean_30": rolling_mean_30,
            "rolling_std_30": rolling_std_30,

            "coal_price_usd_per_mt":
                market_values["coal_price_usd_per_mt"],

            "bunker_price_usd_per_mt":
                market_values["bunker_price_usd_per_mt"],

            "crude_price_usd_per_bbl":
                market_values["crude_price_usd_per_bbl"],

            "port_congestion_index":
                market_values["port_congestion_index"],

            "vessel_availability_index":
                market_values["vessel_availability_index"],

            "month": forecast_date.month,
            "day_of_year": forecast_date.dayofyear,
            "quarter": forecast_date.quarter,

            "origin": origin,
            "destination": destination,
            "vessel_type": vessel_type,
            "commodity": commodity
        }

        # ---------------------------------------------
        # Add market lag/change features
        # ---------------------------------------------

        for feature in [
            "coal_price_usd_per_mt",
            "bunker_price_usd_per_mt",
            "crude_price_usd_per_bbl",
            "port_congestion_index",
            "vessel_availability_index"
        ]:

            current_value = market_values[feature]

            for lag in [1, 7, 14, 30]:
                row[f"{feature}_lag_{lag}"] = current_value

            row[f"{feature}_change_7d"] = 0.0
            row[f"{feature}_change_30d"] = 0.0

        # ---------------------------------------------
        # Convert to DataFrame
        # ---------------------------------------------

        X_future = pd.DataFrame(
            [row]
        )[FEATURE_COLUMNS]

        # ---------------------------------------------
        # Transform
        # ---------------------------------------------

        X_transformed = preprocessor.transform(
            X_future
        )

        # ---------------------------------------------
        # Predict
        # ---------------------------------------------

        prediction = float(
            model.predict(X_transformed)[0]
        )

        # ---------------------------------------------
        # Store prediction
        # ---------------------------------------------

        forecasts.append({

            "forecast_date": forecast_date,

            "origin": origin,

            "destination": destination,

            "vessel_type": vessel_type,

            "commodity": commodity,

            "forecast_day": step,

            "forecast_freight_rate": prediction
        })

        # ---------------------------------------------
        # Add prediction to history
        #
        # This makes the next forecast recursive.
        # ---------------------------------------------

        freight_history.append(
            prediction
        )

        # Keep last 30 observations
        freight_history = freight_history[-30:]

    return pd.DataFrame(forecasts)


# =========================================================
# Example forecast
# =========================================================

if __name__ == "__main__":

    print("\nGenerating example 90-day forecast...")

    forecast = forecast_route(
        historical_df,
        origin="Newcastle_Australia",
        destination="Paradip",
        vessel_type="Capesize",
        commodity="Coal",
        horizon=90
    )

    print("\nForecast sample:")
    print(
        forecast.head(10).to_string(index=False)
    )

    print("\nForecast tail:")
    print(
        forecast.tail(10).to_string(index=False)
    )

    # -----------------------------------------------------
    # Save
    # -----------------------------------------------------

    output_path = (
        "backend/data/processed/"
        "newcastle_paradip_capesize_90d_forecast.csv"
    )

    forecast.to_csv(
        output_path,
        index=False
    )

    print(
        f"\nForecast saved to:\n{output_path}"
    )

    # -----------------------------------------------------
    # Horizon summary
    # -----------------------------------------------------

    print("\nHorizon Summary")
    print("----------------")

    for horizon in FORECAST_HORIZONS:

        horizon_data = forecast[
            forecast["forecast_day"] <= horizon
        ]

        print(
            f"{horizon:>3} days | "
            f"Mean: "
            f"{horizon_data['forecast_freight_rate'].mean():.2f} | "
            f"Min: "
            f"{horizon_data['forecast_freight_rate'].min():.2f} | "
            f"Max: "
            f"{horizon_data['forecast_freight_rate'].max():.2f}"
        )