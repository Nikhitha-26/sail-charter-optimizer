from pathlib import Path
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = BASE_DIR / "data" / "raw"


def load_freight_rates():
    path = RAW_DATA_DIR / "freight_rates.csv"
    df = pd.read_csv(path)

    df["date"] = pd.to_datetime(df["date"])

    return df


def load_market_factors():
    path = RAW_DATA_DIR / "market_factors.csv"
    df = pd.read_csv(path)

    df["date"] = pd.to_datetime(df["date"])

    return df


def load_vessels():
    return pd.read_csv(RAW_DATA_DIR / "vessels.csv")


def load_ports():
    return pd.read_csv(RAW_DATA_DIR / "ports.csv")


def load_cargo_requirements():
    df = pd.read_csv(RAW_DATA_DIR / "cargo_requirements.csv")

    df["earliest_arrival"] = pd.to_datetime(df["earliest_arrival"])
    df["required_by"] = pd.to_datetime(df["required_by"])

    return df


def load_contract_options():
    return pd.read_csv(RAW_DATA_DIR / "contract_options.csv")


def load_voyages():
    return pd.read_csv(RAW_DATA_DIR / "voyages.csv")


if __name__ == "__main__":

    freight = load_freight_rates()
    market = load_market_factors()

    print("Freight data:")
    print(freight.head())
    print(freight.shape)

    print("\nMarket factors:")
    print(market.head())
    print(market.shape)

    print("\nData loading successful.")