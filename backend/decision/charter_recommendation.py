import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]

SCENARIO_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "freight_scenarios_90d.csv"
)

CONTRACT_PATH = BASE_DIR / "data" / "raw" / "contract_options.csv"
VESSEL_PATH = BASE_DIR / "data" / "raw" / "vessels.csv"
PORT_PATH = BASE_DIR / "data" / "raw" / "ports.csv"


def recommend_charter():

    scenarios = pd.read_csv(SCENARIO_PATH)
    contracts = pd.read_csv(CONTRACT_PATH)
    vessels = pd.read_csv(VESSEL_PATH)
    ports = pd.read_csv(PORT_PATH)

    # First 30 days
    forecast_30 = scenarios.head(30)

    avg_30 = forecast_30["base_scenario"].mean()
    low_30 = forecast_30["low_scenario"].mean()
    high_30 = forecast_30["high_scenario"].mean()

    scenario_spread = high_30 - low_30

    print("\n======================================")
    print("CHARTER DECISION ENGINE")
    print("======================================")

    print(f"\n30-day base freight : {avg_30:.2f}")
    print(f"30-day low scenario : {low_30:.2f}")
    print(f"30-day high scenario: {high_30:.2f}")
    print(f"Scenario spread     : {scenario_spread:.2f}")

    # Risk classification
    if scenario_spread < 5:
        risk = "LOW"
    elif scenario_spread < 10:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    print(f"\nMarket risk level: {risk}")

    # Available contracts
    # All prototype contract options are considered available.
    available = contracts.copy()

    if available.empty:
        print("\nNo available contract options.")
        return

    print("\nAvailable contract options:")
    print(
        available[
            [
                "contract_type",
                "duration_months",
                "rate_premium_discount",
                "availability"
            ]
        ].to_string(index=False)
    )

    # Decision logic
    if risk == "HIGH":

        preferred = available.sort_values(
            "duration_months"
        ).iloc[0]

        strategy = (
            "Prefer shorter-duration commitments and "
            "preserve flexibility because forecast "
            "uncertainty is elevated."
        )

    elif risk == "MEDIUM":

        preferred = available.sort_values(
            "duration_months"
        ).iloc[len(available) // 2]

        strategy = (
            "Use a balanced short/medium-term charter "
            "strategy and avoid concentrating the full "
            "requirement in one contract."
        )

    else:

        preferred = available.sort_values(
            "duration_months",
            ascending=False
        ).iloc[0]

        strategy = (
            "Consider a longer-duration multi-voyage "
            "contract to secure freight exposure."
        )

    print("\n--------------------------------------")
    print("RECOMMENDED CHARTER STRATEGY")
    print("--------------------------------------")

    print(
        f"Contract type : {preferred['contract_type']}"
    )

    print(
        f"Duration      : {preferred['duration_months']} months"
    )

    print(
    f"Rate premium/discount: "
    f"{preferred['rate_premium_discount']:.2%}"
    )

    print(
    f"Availability: "
    f"{preferred['availability']}"
    )

    print(f"\nStrategy:\n{strategy}")

    print("\nVessel types:")
    print(", ".join(vessels["vessel_type"].unique()))

    print("\nDestination ports:")
    print(", ".join(ports["port_name"].tolist()))


if __name__ == "__main__":
    recommend_charter()