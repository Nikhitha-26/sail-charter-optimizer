import sys
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt


sys.path.append(
    str(Path(__file__).resolve().parents[2])
)

from backend.ml.data_loader import (
    load_freight_rates,
    load_market_factors
)


# ==========================================================
# LOAD DATA
# ==========================================================

freight = load_freight_rates()
market = load_market_factors()

freight["date"] = pd.to_datetime(
    freight["date"]
)

market["date"] = pd.to_datetime(
    market["date"]
)


# ==========================================================
# AGGREGATE FREIGHT
# ==========================================================

daily_freight = (
    freight
    .groupby("date")["freight_rate"]
    .mean()
    .reset_index()
)


# ==========================================================
# MERGE
# ==========================================================

df = daily_freight.merge(
    market,
    on="date",
    how="inner"
)


# ==========================================================
# CORRELATION
# ==========================================================

numeric_columns = [
    "freight_rate",
    "coal_price_usd_per_mt",
    "bunker_price_usd_per_mt",
    "crude_price_usd_per_bbl",
    "port_congestion_index",
    "vessel_availability_index"
]


correlation = (
    df[numeric_columns]
    .corr()["freight_rate"]
    .sort_values(
        ascending=False
    )
)


print("\n======================================")
print("FREIGHT / MARKET CORRELATIONS")
print("======================================")

print(correlation)


# ==========================================================
# OUTPUT DIRECTORY
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


# ==========================================================
# PLOT 1 — FREIGHT VS COAL
# ==========================================================

plt.figure(figsize=(12, 6))

plt.scatter(
    df["coal_price_usd_per_mt"],
    df["freight_rate"],
    alpha=0.25
)

plt.xlabel(
    "Coal Price (USD/MT)"
)

plt.ylabel(
    "Average Freight Rate (USD/MT)"
)

plt.title(
    "Coal Price vs Average Freight Rate"
)

plt.tight_layout()

plt.savefig(
    output_dir /
    "coal_vs_freight.png",
    dpi=150
)

plt.close()


# ==========================================================
# PLOT 2 — FREIGHT VS BUNKER
# ==========================================================

plt.figure(figsize=(12, 6))

plt.scatter(
    df["bunker_price_usd_per_mt"],
    df["freight_rate"],
    alpha=0.25
)

plt.xlabel(
    "Bunker Price (USD/MT)"
)

plt.ylabel(
    "Average Freight Rate (USD/MT)"
)

plt.title(
    "Bunker Price vs Average Freight Rate"
)

plt.tight_layout()

plt.savefig(
    output_dir /
    "bunker_vs_freight.png",
    dpi=150
)

plt.close()


# ==========================================================
# PLOT 3 — CONGESTION VS FREIGHT
# ==========================================================

plt.figure(figsize=(12, 6))

plt.scatter(
    df["port_congestion_index"],
    df["freight_rate"],
    alpha=0.25
)

plt.xlabel(
    "Port Congestion Index"
)

plt.ylabel(
    "Average Freight Rate (USD/MT)"
)

plt.title(
    "Port Congestion vs Average Freight Rate"
)

plt.tight_layout()

plt.savefig(
    output_dir /
    "congestion_vs_freight.png",
    dpi=150
)

plt.close()


print(
    "\nCharts saved to:"
)

print(output_dir)