/**frontend/src/pages/Decisions.tsx Decisions page*/
import {
  formatINR,
  formatINRPerTonne,
} from '../lib/currency'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react'
import { api } from '../lib/api'
import {
  formatDestinationLabel,
  formatOriginLabel,
  formatQuantity,
  formatWindow,
  normalizeRisk,
} from '../lib/constants'
import { useDecisionContext, type Strategy } from '../store/decisionContext'
import type { DashboardData, DecisionData, PortsResponse } from '../types/api'
import AnalysisMapLayout, {
  useMapOpen,
} from '../components/layout/AnalysisMapLayout'
import ContextMapPanel from '../components/map/ContextMapPanel'
import {
  ErrorPanel,
  LoadingSkeleton,
  PrototypeBadge,
  RiskPill,
} from '../components/ui/Status'

export default function Decisions() {
  const navigate = useNavigate()
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()
  const [data, setData] = useState<DecisionData | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dec, dash, portsRes] = await Promise.all([
        api.decision() as Promise<DecisionData>,
        api.dashboard() as Promise<DashboardData>,
        api.ports() as Promise<PortsResponse>,
      ])
      setData(dec)
      setDashboard(dash)
      setPorts(portsRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load decision')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const strategy: Strategy | null = useMemo(() => {
    if (ctx.selectedStrategy) return ctx.selectedStrategy
    if (!data) return null
    const qty = ctx.quantityMt || data.optimization.total_required_mt
    const base = data.market.base_freight_usd_per_mt * qty
    const low = data.market.low_freight_usd_per_mt * qty
    const high = data.market.high_freight_usd_per_mt * qty
    return {
      id: 'engine-default',
      name: data.decision.strategy,
      contractMix: {
        spotPct: 20,
        shortTermPct: 30,
        mediumTermPct: 50,
      },
      baseCostUsd: data.optimization.total_base_cost_usd || base,
      lowCostUsd: low,
      highCostUsd: high,
      riskProfile: {
        freight: normalizeRisk(data.market.risk_level),
        port: 'MEDIUM',
        vessel: 'MEDIUM',
      },
      bestIf: data.decision.reason,
    }
  }, [ctx.selectedStrategy, ctx.quantityMt, data])

  if (loading && !data) {
    return (
      <section>
        <p className="eyebrow">DECISION MEMO</p>
        <h2>Loading charter decision...</h2>
        <LoadingSkeleton rows={5} />
      </section>
    )
  }

  if (error && !data) {
    return (
      <section>
        <p className="eyebrow">DECISION MEMO</p>
        <h2>Unable to load decision</h2>
        <ErrorPanel message={error} onRetry={() => void load()} />
      </section>
    )
  }

  if (!data || !strategy) return null

  const { market, optimization } = data
  const risk = normalizeRisk(market.risk_level)
  const destPort = ports.find((p) => p.port_id === ctx.destination)

  const checklist = [
    {
      ok: true,
      label: 'Cargo requirement',
      note: `${formatQuantity(ctx.quantityMt)} in window ${formatWindow(ctx.windowStart, ctx.windowEnd)}`,
    },
    {
      ok: optimization.fulfillment_pct >= 99,
      label: 'Vessel availability',
      note: `Modeled fulfillment ${optimization.fulfillment_pct.toFixed(1)}%`,
    },
    {
      ok: !!destPort,
      label: 'Port compatibility',
      note: destPort
        ? `${destPort.port_name}: draft ≤ ${destPort.max_draft_m} m`
        : 'Destination not in ports table',
    },
    {
      ok: (destPort?.baseline_congestion_index ?? 0) < 0.45,
      warn: true,
      label: 'Congestion exposure',
      note: destPort
        ? `Index ${destPort.baseline_congestion_index.toFixed(2)}`
        : 'Unknown',
    },
    {
      ok: !!ctx.windowStart && !!ctx.windowEnd,
      label: 'Contract window',
      note: formatWindow(ctx.windowStart, ctx.windowEnd),
    },
  ]

  return (
    <AnalysisMapLayout
      isMapOpen={isMapOpen}
      onToggleMap={onToggleMap}
      mapContent={
        <ContextMapPanel
          decisionContext={ctx}
          ports={ports}
          riskLevel={normalizeRisk(strategy.riskProfile.freight)}
        />
      }
    >
      <section className="page-section decision-memo">
        <p className="eyebrow">DECISION MEMO</p>
        <h2>Charter decision summary</h2>

        <div className="memo-header panel-card">
          <p className="eyebrow">ANALYSIS CONTEXT</p>
          <h3>
            {formatOriginLabel(ctx.origin)} →{' '}
            {formatDestinationLabel(ctx.destination)}
          </h3>
          <p>
            {ctx.vesselType} · {ctx.commodity} · {formatQuantity(ctx.quantityMt)} ·{' '}
            {formatWindow(ctx.windowStart, ctx.windowEnd)}
          </p>
          {!ctx.selectedStrategy && (
            <p className="inline-note">
              <PrototypeBadge /> Showing engine default strategy. Select one in
              the{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/optimizer')}
              >
                Charter Planner
              </button>{' '}
              to override.
            </p>
          )}
        </div>

        <div className="panel-card">
          <p className="eyebrow">SELECTED STRATEGY</p>
          <h3>{strategy.name}</h3>
          <div className="mix-inline">
            Spot {strategy.contractMix.spotPct}% · Short-term{' '}
            {strategy.contractMix.shortTermPct}% · Medium-term{' '}
            {strategy.contractMix.mediumTermPct}%
          </div>
          <dl className="cost-dl">
            <div>
              <dt>Base cost</dt>
              <dd>{formatINR(strategy.baseCostUsd)}</dd>
            </div>
            <div>
              <dt>Low / High</dt>
              <dd>
                {formatINR(strategy.lowCostUsd)} / {formatINR(strategy.highCostUsd)}
              </dd>
            </div>
          </dl>
          <div className="risk-profile-row">
            <span>
              Freight <RiskPill level={strategy.riskProfile.freight} />
            </span>
            <span>
              Port <RiskPill level={strategy.riskProfile.port} />
            </span>
            <span>
              Vessel <RiskPill level={strategy.riskProfile.vessel} />
            </span>
          </div>
          <p className="best-if">{strategy.bestIf}</p>
        </div>

        <div className="panel-card">
          <p className="eyebrow">MARKET OUTLOOK</p>
          <div className="metric-row compact">
            <div className="metric-card">
              <span>Base freight</span>
              <strong>{formatINRPerTonne(market.base_freight_usd_per_mt)}</strong>
              <small>INR / MT</small>
            </div>
            <div className="metric-card">
              <span>LOW / HIGH</span>
              <strong>
                {formatINRPerTonne(market.low_freight_usd_per_mt)} / {formatINRPerTonne(market.high_freight_usd_per_mt)}
              </strong>
            </div>
            <div className="metric-card">
              <span>Spread</span>
              <strong>{market.scenario_spread_pct.toFixed(1)}%</strong>
            </div>
            <div className="metric-card">
              <span>Risk</span>
              <strong>
                <RiskPill level={risk} />
              </strong>
            </div>
            {dashboard && (
              <div className="metric-card">
                <span>30D forecast</span>
                <strong>{formatINRPerTonne(dashboard.forecast_30d)}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="panel-card">
          <p className="eyebrow">FEASIBILITY CHECKLIST</p>
          <ul className="checklist">
            {checklist.map((item) => (
              <li key={item.label}>
                {item.ok && !item.warn ? (
                  <CheckCircle2 size={16} className="ok" />
                ) : item.warn && item.ok ? (
                  <AlertTriangle size={16} className="warn" />
                ) : item.ok === false && item.warn ? (
                  <AlertTriangle size={16} className="warn" />
                ) : (
                  <CircleAlert size={16} className="bad" />
                )}
                <div>
                  <strong>{item.label}</strong>
                  <span className="muted">{item.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel-card">
          <p className="eyebrow">WHY THIS STRATEGY?</p>
          <ul className="rationale-list">
            {data.explanations.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
            {ctx.selectedStrategy && (
              <li>
                Planner selection: {ctx.selectedStrategy.name} —{' '}
                {ctx.selectedStrategy.bestIf}
              </li>
            )}
          </ul>
        </div>

        <div className="panel-card">
          <p className="eyebrow">ALLOCATION SNAPSHOT</p>
          <div className="metric-row compact">
            <div className="metric-card">
              <span>Required</span>
              <strong>
                {optimization.total_required_mt.toLocaleString()} MT
              </strong>
            </div>
            <div className="metric-card">
              <span>Allocated</span>
              <strong>
                {optimization.total_allocated_mt.toLocaleString()} MT
              </strong>
            </div>
            <div className="metric-card">
              <span>High exposure</span>
              <strong>
                {formatINR(optimization.high_scenario_exposure_usd)}
              </strong>
            </div>
          </div>
          <div className="vessel-mix">
            {Object.entries(optimization.vessel_mix).map(([type, mt]) => (
              <span key={type}>
                {type}: {mt.toLocaleString()} MT
              </span>
            ))}
          </div>
        </div>
      </section>
    </AnalysisMapLayout>
  )
}
