from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import pandas as pd
import json


BASE_DIR = Path(__file__).resolve().parents[1]

RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"


SCENARIO_PATH = PROCESSED_DIR / "freight_scenarios_90d.csv"
FORECAST_PATH = PROCESSED_DIR / "newcastle_paradip_capesize_90d_forecast.csv"
PREDICTION_PATH = PROCESSED_DIR / "forecast_test_predictions.csv"
ERROR_PATH = PROCESSED_DIR / "forecast_error_distribution.csv"
DECISION_PATH = PROCESSED_DIR / "charter_decision.json"

VESSELS_PATH = RAW_DIR / "vessels.csv"
PORTS_PATH = RAW_DIR / "ports.csv"
CONTRACTS_PATH = RAW_DIR / "contract_options.csv"
CARGO_PATH = RAW_DIR / "cargo_requirements.csv"
VOYAGES_PATH = RAW_DIR / "voyages.csv"


app = FastAPI(
    title="SAIL Intelligent Freight Forecasting API",
    description="Backend API for FreightIQ vessel chartering and bulk cargo procurement",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Health
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "system": "SAIL Intelligent Freight Forecasting",
        "product": "FreightIQ",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "forecast_model": "XGBoost",
        "forecast_horizon": "90 days",
    }


# ---------------------------------------------------------
# Freight Forecast
# ---------------------------------------------------------

@app.get("/api/decision")
def decision():
    decision_path = PROCESSED_DIR / "charter_decision.json"

    if not decision_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Decision output not found. Run charter_decision_engine.py first."
        )

    with open(decision_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/forecast")
def forecast():
    df = pd.read_csv(SCENARIO_PATH)

    return {
        "route": {
            "origin": "Newcastle_Australia",
            "destination": "Paradip",
            "vessel_type": "Capesize",
            "commodity": "Coal",
        },
        "forecast": df.to_dict(orient="records"),
    }


@app.get("/api/forecast/summary")
def forecast_summary():
    df = pd.read_csv(SCENARIO_PATH)

    first_7 = df.head(7)
    first_30 = df.head(30)
    first_90 = df.head(90)

    return {
        "current_rate": round(float(df.iloc[0]["forecast_freight_rate"]), 2),

        "forecast_7d": round(
            float(first_7["base_scenario"].mean()), 2
        ),

        "forecast_30d": round(
            float(first_30["base_scenario"].mean()), 2
        ),

        "forecast_90d": round(
            float(first_90["base_scenario"].mean()), 2
        ),

        "low_30d": round(
            float(first_30["low_scenario"].mean()), 2
        ),

        "high_30d": round(
            float(first_30["high_scenario"].mean()), 2
        ),

        "scenario_spread_30d": round(
            float(
                (
                    first_30["high_scenario"]
                    - first_30["low_scenario"]
                ).mean()
            ),
            2,
        ),
    }


# ---------------------------------------------------------
# Model performance
# ---------------------------------------------------------

@app.get("/api/model/performance")
def model_performance():

    df = pd.read_csv(PREDICTION_PATH)

    actual = df["freight_rate"]
    predicted = df["predicted_rate"]

    mae = (actual - predicted).abs().mean()
    rmse = ((actual - predicted) ** 2).mean() ** 0.5

    return {
        "model": "XGBoost",
        "mae": round(float(mae), 4),
        "rmse": round(float(rmse), 4),
        "baseline_mae": 1.6177,
        "improvement_percent": 14.87,
    }


# ---------------------------------------------------------
# Forecast uncertainty
# ---------------------------------------------------------

@app.get("/api/uncertainty")
def uncertainty():

    df = pd.read_csv(ERROR_PATH)

    return dict(
        zip(
            df["statistic"],
            df["value"]
        )
    )


# ---------------------------------------------------------
# Vessels
# ---------------------------------------------------------

@app.get("/api/vessels")
def vessels():

    df = pd.read_csv(VESSELS_PATH)

    return {
        "count": len(df),
        "vessels": df.to_dict(orient="records"),
    }


# ---------------------------------------------------------
# Ports
# ---------------------------------------------------------

@app.get("/api/ports")
def ports():

    df = pd.read_csv(PORTS_PATH)

    return {
        "count": len(df),
        "ports": df.to_dict(orient="records"),
    }


# ---------------------------------------------------------
# Contract options
# ---------------------------------------------------------

@app.get("/api/contracts")
def contracts():

    df = pd.read_csv(CONTRACTS_PATH)

    return {
        "contracts": df.to_dict(orient="records"),
    }


# ---------------------------------------------------------
# Cargo requirements
# ---------------------------------------------------------

@app.get("/api/cargo")
def cargo():

    df = pd.read_csv(CARGO_PATH)

    return {
        "cargo": df.to_dict(orient="records"),
    }


# ---------------------------------------------------------
# Voyages
# ---------------------------------------------------------

@app.get("/api/voyages")
def voyages():

    df = pd.read_csv(VOYAGES_PATH)

    return {
        "voyages": df.to_dict(orient="records"),
    }


# ---------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------
@app.get("/api/dashboard")
def dashboard():

    forecast_df = pd.read_csv(SCENARIO_PATH)

    # ---------------------------------------------------------
    # Load authoritative risk/decision output
    # ---------------------------------------------------------

    if not DECISION_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Decision output not found. "
                "Run charter_decision_engine.py first."
            )
        )

    with open(DECISION_PATH, "r", encoding="utf-8") as f:
        decision_data = json.load(f)

    market = decision_data["market"]

    # ---------------------------------------------------------
    # Forecast information
    # ---------------------------------------------------------

    first_30 = forecast_df.head(30)

    forecast_30d = float(
        first_30["base_scenario"].mean()
    )

    current_rate = float(
        forecast_df.iloc[0]["forecast_freight_rate"]
    )

    # ---------------------------------------------------------
    # Risk information
    #
    # IMPORTANT:
    # Risk is taken from the Decision Engine.
    # This keeps Dashboard and Decisions consistent.
    # ---------------------------------------------------------

    risk = market["risk_level"]

    low = float(
        market["low_freight_usd_per_mt"]
    )

    high = float(
        market["high_freight_usd_per_mt"]
    )

    spread = float(
        market["scenario_spread_pct"]
    )

    return {
        "route": "Newcastle → Paradip",

        "current_rate": round(
            current_rate,
            2,
        ),

        "forecast_30d": round(
            forecast_30d,
            2,
        ),

        "low_scenario": round(
            low,
            2,
        ),

        "high_scenario": round(
            high,
            2,
        ),

        "scenario_spread": round(
            spread,
            2,
        ),

        "risk_level": risk,

        "model": {
            "name": "XGBoost",
            "horizon": "90 days",
            "mae": 1.3771,
            "baseline_mae": 1.6177,
            "improvement_percent": 14.87,
        },
    }