export interface ApiHealth {
  status: string
  [key: string]: unknown
}

export interface DashboardData {
  [key: string]: unknown
}

export interface ForecastData {
  [key: string]: unknown
}

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