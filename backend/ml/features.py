"""backend/ml/features.py create forecasting dataset"""

import pandas as pd


def create_forecasting_dataset(freight_df, market_df):

    freight_df = freight_df.copy()
    market_df = market_df.copy()

    freight_df["date"] = pd.to_datetime(
        freight_df["date"]
    )

    market_df["date"] = pd.to_datetime(
        market_df["date"]
    )

    # ==========================================================
    # FREIGHT FEATURES
    # ==========================================================

    group_cols = [
        "origin",
        "destination",
        "vessel_type"
    ]

    freight_df = freight_df.sort_values(
        group_cols + ["date"]
    )

    grouped_freight = (
        freight_df
        .groupby(group_cols)["freight_rate"]
    )

    # Lag features
    for lag in [1, 7, 14, 30]:

        freight_df[
            f"freight_rate_lag_{lag}"
        ] = grouped_freight.shift(lag)

    # Rolling features
    freight_df["rolling_mean_7"] = (
        freight_df
        .groupby(group_cols)["freight_rate"]
        .transform(
            lambda x:
            x.shift(1)
            .rolling(7)
            .mean()
        )
    )

    freight_df["rolling_mean_30"] = (
        freight_df
        .groupby(group_cols)["freight_rate"]
        .transform(
            lambda x:
            x.shift(1)
            .rolling(30)
            .mean()
        )
    )

    freight_df["rolling_std_30"] = (
        freight_df
        .groupby(group_cols)["freight_rate"]
        .transform(
            lambda x:
            x.shift(1)
            .rolling(30)
            .std()
        )
    )

    # ==========================================================
    # MARKET FEATURES
    # ==========================================================

    market_features = [
        "coal_price_usd_per_mt",
        "bunker_price_usd_per_mt",
        "crude_price_usd_per_bbl",
        "port_congestion_index",
        "vessel_availability_index"
    ]

    market_df = market_df.sort_values("date")

    # Market lags
    for feature in market_features:

        for lag in [1, 7, 14, 30]:

            market_df[
                f"{feature}_lag_{lag}"
            ] = market_df[feature].shift(lag)

        # 7-day change
        market_df[
            f"{feature}_change_7d"
        ] = (
            market_df[feature]
            - market_df[feature].shift(7)
        )

        # 30-day change
        market_df[
            f"{feature}_change_30d"
        ] = (
            market_df[feature]
            - market_df[feature].shift(30)
        )

    # ==========================================================
    # CALENDAR FEATURES
    # ==========================================================

    freight_df["month"] = (
        freight_df["date"].dt.month
    )

    freight_df["day_of_year"] = (
        freight_df["date"].dt.dayofyear
    )

    freight_df["quarter"] = (
        freight_df["date"].dt.quarter
    )

    # ==========================================================
    # MERGE
    # ==========================================================

    df = freight_df.merge(
        market_df,
        on="date",
        how="left"
    )

    # ==========================================================
    # REMOVE MISSING VALUES
    # ==========================================================

    df = (
        df
        .dropna()
        .reset_index(drop=True)
    )

    return df