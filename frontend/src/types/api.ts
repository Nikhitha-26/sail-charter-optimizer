export interface ApiHealth {
  status: string
  forecast_model?: string
  forecast_horizon?: string
  [key: string]: unknown
}

export interface DashboardData {
  route: string
  current_rate: number
  forecast_30d: number
  low_scenario: number
  high_scenario: number
  scenario_spread: number
  risk_level: string
  model: {
    name: string
    horizon: string
    mae: number
    baseline_mae: number
    improvement_percent: number
  }
}

export interface ForecastPoint {
  forecast_date: string
  origin: string
  destination: string
  vessel_type: string
  commodity: string
  forecast_day: number
  forecast_freight_rate: number
  base_forecast: number
  low_scenario: number
  base_scenario: number
  high_scenario: number
  scenario_spread: number
}

export interface ForecastData {
  route: {
    origin: string
    destination: string
    vessel_type: string
    commodity: string
  }
  forecast: ForecastPoint[]
}

export interface ForecastSummary {
  current_rate: number
  forecast_7d: number
  forecast_30d: number
  forecast_90d: number
  low_30d: number
  high_30d: number
  scenario_spread_30d: number
}

export interface ModelPerformance {
  model: string
  mae: number
  rmse: number
  baseline_mae: number
  improvement_percent: number
}

export interface UncertaintyData {
  MAE: number
  RMSE: number
  mean_error: number
  std_error: number
  P10: number
  P25: number
  P50: number
  P75: number
  P90: number
  [key: string]: number
}

export interface Port {
  port_id: string
  port_name: string
  country: string
  max_loa_m: number
  max_beam_m: number
  max_draft_m: number
  cargo_handling_rate_tph: number
  berth_count: number
  approach_depth_m: number
  baseline_congestion_index: number
  source: string
}

export interface PortsResponse {
  count: number
  ports: Port[]
}

export interface Vessel {
  vessel_id: string
  vessel_type: string
  dwt_mt: number
  loa_m: number
  beam_m: number
  draft_m: number
  speed_knots: number
  cargo_capacity_mt: number
  fuel_consumption_laden_mt_day: number
  fuel_consumption_ballast_mt_day: number
  source: string
}

export interface VesselsResponse {
  count: number
  vessels: Vessel[]
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DecisionData {
  decision: {
    strategy: string
    contract_duration_months: number
    contract_terms: {
      contract_id: string
      contract_type: string
      duration_months: number
      min_quantity_mt: number
      max_quantity_mt: number
      rate_adjustment: number
      availability: string
    }
    reason: string
  }

  market: {
    base_freight_usd_per_mt: number
    low_freight_usd_per_mt: number
    high_freight_usd_per_mt: number
    scenario_spread_pct: number
    risk_level: string
  }

  optimization: {
    total_required_mt: number
    total_allocated_mt: number
    shortage_mt: number
    fulfillment_pct: number
    total_base_cost_usd: number
    high_scenario_exposure_usd: number
    deadline_infeasible_cargoes: number
    vessel_mix: Record<string, number>
  }

  explanations: string[]
}
