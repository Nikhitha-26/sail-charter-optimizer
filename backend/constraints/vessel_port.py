from pathlib import Path
import math
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = BASE_DIR / "data" / "raw"


# ============================================================
# DATA LOADERS
# ============================================================

def load_vessels():
    path = RAW_DATA_DIR / "vessels.csv"
    return pd.read_csv(path)


def load_ports():
    path = RAW_DATA_DIR / "ports.csv"
    return pd.read_csv(path)


def load_cargo():
    path = RAW_DATA_DIR / "cargo_requirements.csv"

    df = pd.read_csv(path)

    df["earliest_arrival"] = pd.to_datetime(df["earliest_arrival"])
    df["required_by"] = pd.to_datetime(df["required_by"])

    return df


# ============================================================
# SINGLE VESSEL / PORT FEASIBILITY
# ============================================================

def check_vessel_port_feasibility(vessel, port):
    """
    Check whether a vessel can physically call at a port.

    Returns:
        {
            "feasible": bool,
            "reasons": list[str]
        }
    """

    reasons = []

    # --------------------------------------------------------
    # LOA
    # --------------------------------------------------------

    if vessel["loa_m"] > port["max_loa_m"]:
        reasons.append(
            f"LOA {vessel['loa_m']}m exceeds port limit "
            f"{port['max_loa_m']}m"
        )

    # --------------------------------------------------------
    # BEAM
    # --------------------------------------------------------

    if vessel["beam_m"] > port["max_beam_m"]:
        reasons.append(
            f"Beam {vessel['beam_m']}m exceeds port limit "
            f"{port['max_beam_m']}m"
        )

    # --------------------------------------------------------
    # DRAFT
    # --------------------------------------------------------

    if vessel["draft_m"] > port["max_draft_m"]:
        reasons.append(
            f"Draft {vessel['draft_m']}m exceeds port limit "
            f"{port['max_draft_m']}m"
        )

    # --------------------------------------------------------
    # APPROACH DEPTH
    # --------------------------------------------------------

    if vessel["draft_m"] > port["approach_depth_m"]:
        reasons.append(
            f"Draft {vessel['draft_m']}m exceeds approach depth "
            f"{port['approach_depth_m']}m"
        )

    return {
        "feasible": len(reasons) == 0,
        "reasons": reasons
    }


# ============================================================
# CARGO / VESSEL FEASIBILITY
# ============================================================

def calculate_required_voyages(quantity_tonnes, cargo_capacity_mt):
    """
    Calculate the minimum number of voyages required
    to transport the cargo quantity.
    """

    if cargo_capacity_mt <= 0:
        raise ValueError("Vessel cargo capacity must be greater than zero.")

    return math.ceil(quantity_tonnes / cargo_capacity_mt)


def check_cargo_vessel_feasibility(cargo, vessel, port):
    """
    Complete feasibility check for:

        Cargo -> Vessel -> Destination Port
    """

    port_check = check_vessel_port_feasibility(vessel, port)

    required_voyages = calculate_required_voyages(
        cargo["quantity_tonnes"],
        vessel["cargo_capacity_mt"]
    )

    total_capacity = (
        required_voyages * vessel["cargo_capacity_mt"]
    )

    cargo_capacity_ok = total_capacity >= cargo["quantity_tonnes"]

    reasons = list(port_check["reasons"])

    if not cargo_capacity_ok:
        reasons.append(
            "Insufficient total vessel capacity."
        )

    feasible = (
        port_check["feasible"]
        and cargo_capacity_ok
    )

    return {
        "cargo_id": cargo["cargo_id"],
        "vessel_id": vessel["vessel_id"],
        "vessel_type": vessel["vessel_type"],
        "destination": cargo["destination"],
        "quantity_tonnes": float(cargo["quantity_tonnes"]),
        "vessel_capacity_mt": float(vessel["cargo_capacity_mt"]),
        "required_voyages": required_voyages,
        "total_available_capacity_mt": float(total_capacity),
        "feasible": feasible,
        "reasons": reasons
    }


# ============================================================
# ALL CARGO / VESSEL / PORT COMBINATIONS
# ============================================================

def generate_feasibility_matrix():
    """
    Generate feasibility results for every cargo-vessel
    combination using the cargo destination's port.
    """

    cargo_df = load_cargo()
    vessels_df = load_vessels()
    ports_df = load_ports()

    results = []

    for _, cargo in cargo_df.iterrows():

        # Find destination port
        matching_ports = ports_df[
            ports_df["port_id"] == cargo["destination"]
        ]

        if matching_ports.empty:
            results.append({
                "cargo_id": cargo["cargo_id"],
                "vessel_id": None,
                "vessel_type": None,
                "destination": cargo["destination"],
                "quantity_tonnes": float(cargo["quantity_tonnes"]),
                "vessel_capacity_mt": None,
                "required_voyages": None,
                "total_available_capacity_mt": None,
                "feasible": False,
                "reasons": [
                    f"No port definition found for "
                    f"{cargo['destination']}"
                ]
            })

            continue

        port = matching_ports.iloc[0]

        for _, vessel in vessels_df.iterrows():

            result = check_cargo_vessel_feasibility(
                cargo,
                vessel,
                port
            )

            results.append(result)

    return pd.DataFrame(results)


# ============================================================
# HUMAN-READABLE REPORT
# ============================================================

def print_feasibility_report(df):
    print()
    print("=" * 70)
    print("VESSEL / PORT / CARGO FEASIBILITY")
    print("=" * 70)

    for cargo_id in df["cargo_id"].unique():

        cargo_results = df[
            df["cargo_id"] == cargo_id
        ]

        print()
        print(f"Cargo: {cargo_id}")
        print("-" * 70)

        for _, row in cargo_results.iterrows():

            status = "FEASIBLE" if row["feasible"] else "INFEASIBLE"

            print(
                f"{row['vessel_id']:10s} "
                f"{row['vessel_type']:10s} "
                f"-> {status}"
            )

            print(
                f"   Required voyages: "
                f"{row['required_voyages']}"
            )

            if row["reasons"]:
                for reason in row["reasons"]:
                    print(f"   Reason: {reason}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    feasibility_df = generate_feasibility_matrix()

    output_path = (
        BASE_DIR
        / "data"
        / "processed"
        / "vessel_port_feasibility.csv"
    )

    feasibility_df.to_csv(
        output_path,
        index=False
    )

    print_feasibility_report(feasibility_df)

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total = len(feasibility_df)
    feasible = feasibility_df["feasible"].sum()
    infeasible = total - feasible

    print(f"Total combinations : {total}")
    print(f"Feasible           : {feasible}")
    print(f"Infeasible         : {infeasible}")

    print()
    print(f"Saved to:")
    print(output_path)