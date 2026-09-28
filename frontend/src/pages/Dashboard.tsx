import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface DashboardData {
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .dashboard()
      .then((result) => setData(result as DashboardData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section>
        <p className="eyebrow">FREIGHT DECISION SUPPORT</p>
        <h2>Loading market intelligence...</h2>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <p className="eyebrow">FREIGHT DECISION SUPPORT</p>
        <h2>Unable to load dashboard</h2>
        <p className="intro">{error}</p>
      </section>
    )
  }

  if (!data) return null

  return (
    <section>
      <p className="eyebrow">FREIGHT DECISION SUPPORT</p>

      <h2>From market uncertainty to charter decisions.</h2>

      <p className="intro">
        Monitor freight markets, forecast rate movements, evaluate uncertainty
        and identify feasible vessel charter strategies.
      </p>

      <div className="dashboard-route">
        <p className="eyebrow">MONITORED ROUTE</p>
        <h3>{data.route}</h3>
      </div>

      <div className="dashboard-metrics">
        <div className="metric-card">
          <span>Current Freight</span>
          <strong>${data.current_rate.toFixed(2)}</strong>
          <small>USD / MT</small>
        </div>

        <div className="metric-card">
          <span>30-Day Forecast</span>
          <strong>${data.forecast_30d.toFixed(2)}</strong>
          <small>USD / MT</small>
        </div>

        <div className="metric-card">
          <span>Low Scenario</span>
          <strong>${data.low_scenario.toFixed(2)}</strong>
          <small>USD / MT</small>
        </div>

        <div className="metric-card">
          <span>High Scenario</span>
          <strong>${data.high_scenario.toFixed(2)}</strong>
          <small>USD / MT</small>
        </div>

        <div className="metric-card">
          <span>Scenario Spread</span>
          <strong>${data.scenario_spread.toFixed(2)}</strong>
          <small>USD / MT</small>
        </div>

        <div className="metric-card">
          <span>Risk Level</span>
          <strong>{data.risk_level}</strong>
          <small>Market risk</small>
        </div>
      </div>

      <div className="model-section">
        <p className="eyebrow">FORECAST MODEL</p>

        <h3>{data.model.name}</h3>

        <p>
          Forecast Horizon:{' '}
          <strong>{data.model.horizon}</strong>
        </p>

        <p>
          Model MAE:{' '}
          <strong>{data.model.mae.toFixed(4)}</strong>
        </p>

        <p>
          Baseline MAE:{' '}
          <strong>{data.model.baseline_mae.toFixed(4)}</strong>
        </p>

        <p>
          Improvement over baseline:{' '}
          <strong>{data.model.improvement_percent.toFixed(2)}%</strong>
        </p>
      </div>
    </section>
  )
}