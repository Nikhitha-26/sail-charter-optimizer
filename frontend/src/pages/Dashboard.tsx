import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Map } from 'lucide-react'
import { api } from '../lib/api'
import { congestionToRisk, normalizeRisk } from '../lib/constants'
import { useDecisionContext } from '../store/decisionContext'
import type { DashboardData, DecisionData, PortsResponse } from '../types/api'
import FreightMap from '../components/map/FreightMap'
import ContextMapPanel from '../components/map/ContextMapPanel'
import {
  ErrorPanel,
  LoadingSkeleton,
  PrototypeBadge,
  RiskPill,
} from '../components/ui/Status'

export default function Dashboard() {
  const navigate = useNavigate()
  const ctx = useDecisionContext()
  const [data, setData] = useState<DashboardData | null>(null)
  const [decision, setDecision] = useState<DecisionData | null>(null)
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapModal, setMapModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, dec, portsRes] = await Promise.all([
        api.dashboard() as Promise<DashboardData>,
        api.decision() as Promise<DecisionData>,
        api.ports() as Promise<PortsResponse>,
      ])
      setData(dash)
      setDecision(dec)
      setPorts(portsRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <section>
        <p className="eyebrow">FREIGHT DECISION SUPPORT</p>
        <h2>Loading market intelligence...</h2>
        <LoadingSkeleton rows={4} />
      </section>
    )
  }

  if (error && !data) {
    return (
      <section>
        <p className="eyebrow">FREIGHT DECISION SUPPORT</p>
        <h2>Unable to load dashboard</h2>
        <ErrorPanel message={error} onRetry={() => void load()} />
      </section>
    )
  }

  if (!data) return null

  const risk = normalizeRisk(data.risk_level)
  const alerts = buildAlerts(ports, data, decision)

  return (
    <section className="page-section">
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

      <div className="metric-row">
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
          <span>LOW / HIGH</span>
          <strong>
            ${data.low_scenario.toFixed(2)} / ${data.high_scenario.toFixed(2)}
          </strong>
          <small>USD / MT</small>
        </div>
        <div className="metric-card">
          <span>Scenario Spread</span>
          <strong>
            {decision
              ? `${decision.market.scenario_spread_pct.toFixed(1)}%`
              : `$${data.scenario_spread.toFixed(2)}`}
          </strong>
          <small>{decision ? 'of base rate' : 'USD / MT'}</small>
        </div>
        <div className="metric-card">
          <span>Risk Level</span>
          <strong>
            <RiskPill level={risk} />
          </strong>
          <small>Market risk</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel-card">
          <p className="eyebrow">ATTENTION</p>
          <h3>Items requiring review</h3>
          <ul className="attention-list">
            {alerts.map((a) => (
              <li key={a}>
                <PrototypeBadge text="Derived" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-card map-snapshot">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">TRADE LANE</p>
              <h3>Lane snapshot</h3>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setMapModal(true)}
            >
              <Map size={13} />
              Expand map
            </button>
          </div>
          <button
            type="button"
            className="map-snapshot-btn"
            onClick={() => setMapModal(true)}
            aria-label="Open full trade lane map"
          >
            <FreightMap
              origin={ctx.origin}
              destination={ctx.destination}
              ports={ports}
              riskLevel={risk}
              compact
            />
          </button>
        </div>
      </div>

      <div className="cta-row">
        <button
          type="button"
          className="btn-primary btn-lg"
          onClick={() => navigate('/optimizer')}
        >
          Open Charter Planner
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/forecast')}
        >
          Review forecast
        </button>
      </div>

      <div className="model-section panel-card">
        <p className="eyebrow">FORECAST MODEL</p>
        <h3>{data.model.name}</h3>
        <div className="metric-row compact">
          <div className="metric-card">
            <span>Horizon</span>
            <strong>{data.model.horizon}</strong>
          </div>
          <div className="metric-card">
            <span>MAE</span>
            <strong>{data.model.mae.toFixed(4)}</strong>
          </div>
          <div className="metric-card">
            <span>Baseline MAE</span>
            <strong>{data.model.baseline_mae.toFixed(4)}</strong>
          </div>
          <div className="metric-card">
            <span>Improvement</span>
            <strong>{data.model.improvement_percent.toFixed(2)}%</strong>
          </div>
        </div>
      </div>

      {mapModal && (
        <div className="modal-backdrop" onClick={() => setMapModal(false)}>
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="card-title-row">
              <h3>Trade lane context</h3>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setMapModal(false)}
              >
                Close
              </button>
            </div>
            <ContextMapPanel
              decisionContext={ctx}
              ports={ports}
              riskLevel={risk}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function buildAlerts(
  ports: PortsResponse['ports'],
  data: DashboardData,
  decision: DecisionData | null,
): string[] {
  const items: string[] = []
  const paradip = ports.find((p) => p.port_id === 'Paradip')
  if (paradip) {
    const level = congestionToRisk(paradip.baseline_congestion_index)
    items.push(
      `Paradip congestion: ${level.toLowerCase()} (index ${paradip.baseline_congestion_index.toFixed(2)}), watch for berth delays.`,
    )
  }
  const haldia = ports.find((p) => p.port_id === 'Haldia')
  if (haldia && haldia.baseline_congestion_index >= 0.45) {
    items.push(
      `Haldia congestion elevated (${haldia.baseline_congestion_index.toFixed(2)}); draft-limited for Capesize.`,
    )
  }
  if (normalizeRisk(data.risk_level) !== 'LOW') {
    items.push(
      `Capesize availability tightening on Australia–India lane – market risk ${data.risk_level}.`,
    )
  }
  if (decision && decision.optimization.deadline_infeasible_cargoes > 0) {
    items.push(
      `${decision.optimization.deadline_infeasible_cargoes} cargo requirements show deadline feasibility pressure in the current allocation.`,
    )
  }
  if (items.length === 0) {
    items.push('No elevated alerts on the monitored lane (prototype scan).')
  }
  return items.slice(0, 4)
}
