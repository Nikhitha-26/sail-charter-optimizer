import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import {
  COMMODITIES,
  DESTINATIONS,
  ORIGINS,
  normalizeRisk,
} from '../lib/constants'
import {
  useDecisionContext,
  type Strategy,
} from '../store/decisionContext'
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

type RiskPref = 'LOW' | 'MEDIUM' | 'HIGH'

export default function Optimizer() {
  const navigate = useNavigate()
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()

  const [form, setForm] = useState({
    commodity: ctx.commodity,
    quantityMt: ctx.quantityMt,
    origin: ctx.origin,
    destination: ctx.destination,
    windowStart: ctx.windowStart,
    windowEnd: ctx.windowEnd,
    riskPreference: 'MEDIUM' as RiskPref,
  })

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [decision, setDecision] = useState<DecisionData | null>(null)
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, dec, portsRes] = await Promise.all([
        api.dashboard() as Promise<DashboardData>,
        api.decision() as Promise<DecisionData>,
        api.ports() as Promise<PortsResponse>,
      ])
      setDashboard(dash)
      setDecision(dec)
      setPorts(portsRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planner data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const findStrategies = () => {
    ctx.setContext({
      commodity: form.commodity,
      quantityMt: form.quantityMt,
      origin: form.origin,
      destination: form.destination,
      windowStart: form.windowStart,
      windowEnd: form.windowEnd,
    })

    const baseRate =
      decision?.market.base_freight_usd_per_mt ??
      dashboard?.current_rate ??
      33
    const lowRate =
      decision?.market.low_freight_usd_per_mt ?? dashboard?.low_scenario ?? baseRate * 0.93
    const highRate =
      decision?.market.high_freight_usd_per_mt ??
      dashboard?.high_scenario ??
      baseRate * 1.07
    const spreadPct =
      decision?.market.scenario_spread_pct ??
      ((highRate - lowRate) / baseRate) * 100

    const qty = form.quantityMt
    const generatedStrategies = generateStrategies(
      form.riskPreference,
      qty,
      baseRate,
      lowRate,
      highRate,
      spreadPct,
    )
    setStrategies(generatedStrategies)
    setGenerated(true)
  }

  const selectStrategy = (s: Strategy) => {
    ctx.setSelectedStrategy(s)
    navigate('/decisions')
  }

  if (loading && !dashboard) {
    return (
      <section>
        <p className="eyebrow">CHARTER PLANNER</p>
        <h2>Loading planner...</h2>
        <LoadingSkeleton rows={4} />
      </section>
    )
  }

  if (error && !dashboard) {
    return (
      <section>
        <p className="eyebrow">CHARTER PLANNER</p>
        <h2>Unable to load planner</h2>
        <ErrorPanel message={error} onRetry={() => void load()} />
      </section>
    )
  }

  const mapRisk = normalizeRisk(
    ctx.selectedStrategy?.riskProfile.freight ??
      decision?.market.risk_level ??
      dashboard?.risk_level ??
      'MEDIUM',
  )

  return (
    <AnalysisMapLayout
      isMapOpen={isMapOpen}
      onToggleMap={onToggleMap}
      mapContent={
        <ContextMapPanel
          decisionContext={{
            origin: form.origin,
            destination: form.destination,
            vesselType: ctx.vesselType,
          }}
          ports={ports}
          riskLevel={mapRisk}
        />
      }
    >
      <section className="page-section">
        <p className="eyebrow">CHARTER PLANNER</p>
        <h2>Charter strategy planner</h2>
        <p className="intro">
          Define cargo requirements and risk preference, then review illustrative
          contract-mix strategies for the monitored lane.
        </p>

        <form
          className="selector-form"
          onSubmit={(e) => {
            e.preventDefault()
            findStrategies()
          }}
        >
          <label>
            Commodity
            <select
              value={form.commodity}
              onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))}
            >
              {COMMODITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity (MT)
            <input
              type="number"
              min={10000}
              step={10000}
              value={form.quantityMt}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantityMt: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            Origin
            <select
              value={form.origin}
              onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination
            <select
              value={form.destination}
              onChange={(e) =>
                setForm((f) => ({ ...f, destination: e.target.value }))
              }
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Window start
            <input
              type="date"
              value={form.windowStart}
              onChange={(e) =>
                setForm((f) => ({ ...f, windowStart: e.target.value }))
              }
            />
          </label>
          <label>
            Window end
            <input
              type="date"
              value={form.windowEnd}
              onChange={(e) => setForm((f) => ({ ...f, windowEnd: e.target.value }))}
            />
          </label>
          <label>
            Risk preference
            <select
              value={form.riskPreference}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  riskPreference: e.target.value as RiskPref,
                }))
              }
            >
              <option value="LOW">Low – prefer coverage</option>
              <option value="MEDIUM">Medium – balanced</option>
              <option value="HIGH">High – prefer flexibility</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Find strategies
          </button>
        </form>

        {generated && (
          <>
            <p className="inline-note">
              <PrototypeBadge text="Prototype strategy generator – illustrative only" />
            </p>
            <div className="strategy-grid">
              {strategies.map((s) => (
                <div key={s.id} className="strategy-card">
                  <h3>{s.name}</h3>
                  <div className="mix-bars">
                    <MixBar label="Spot" pct={s.contractMix.spotPct} color="#a0452e" />
                    <MixBar
                      label="Short-term"
                      pct={s.contractMix.shortTermPct}
                      color="#b8860b"
                    />
                    <MixBar
                      label="Medium-term"
                      pct={s.contractMix.mediumTermPct}
                      color="#3d5a45"
                    />
                  </div>
                  <dl className="cost-dl">
                    <div>
                      <dt>Base cost</dt>
                      <dd>${Math.round(s.baseCostUsd).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Low / High</dt>
                      <dd>
                        ${Math.round(s.lowCostUsd).toLocaleString()} / $
                        {Math.round(s.highCostUsd).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <div className="risk-profile-row">
                    <span>
                      Freight <RiskPill level={s.riskProfile.freight} />
                    </span>
                    <span>
                      Port <RiskPill level={s.riskProfile.port} />
                    </span>
                    <span>
                      Vessel <RiskPill level={s.riskProfile.vessel} />
                    </span>
                  </div>
                  <p className="best-if">{s.bestIf}</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => selectStrategy(s)}
                  >
                    Select strategy
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </AnalysisMapLayout>
  )
}

function MixBar({
  label,
  pct,
  color,
}: {
  label: string
  pct: number
  color: string
}) {
  return (
    <div className="mix-bar">
      <div className="mix-bar-label">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mix-bar-track">
        <div
          className="mix-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function generateStrategies(
  pref: RiskPref,
  qty: number,
  baseRate: number,
  lowRate: number,
  highRate: number,
  spreadPct: number,
): Strategy[] {
  // Contract mix adjustments vs spot: medium-term discount, short-term slight premium
  const costFor = (mix: Strategy['contractMix']) => {
    const adj =
      (mix.spotPct / 100) * 1.02 +
      (mix.shortTermPct / 100) * 1.0 +
      (mix.mediumTermPct / 100) * 0.97
    const base = baseRate * qty * adj
    const low = lowRate * qty * adj
    const high = highRate * qty * adj * (1 + spreadPct / 200)
    return { base, low, high }
  }

  const templates: Omit<Strategy, 'baseCostUsd' | 'lowCostUsd' | 'highCostUsd'>[] =
    pref === 'LOW'
      ? [
          {
            id: 'protected-mt',
            name: 'Protected medium-term',
            contractMix: { spotPct: 10, shortTermPct: 25, mediumTermPct: 65 },
            riskProfile: { freight: 'LOW', port: 'MEDIUM', vessel: 'LOW' },
            bestIf:
              'Best if you expect freight to rise and want multi-voyage coverage.',
          },
          {
            id: 'covered-balance',
            name: 'Coverage-biased balance',
            contractMix: { spotPct: 15, shortTermPct: 35, mediumTermPct: 50 },
            riskProfile: { freight: 'LOW', port: 'MEDIUM', vessel: 'MEDIUM' },
            bestIf:
              'Best if you need schedule certainty with limited spot exposure.',
          },
        ]
      : pref === 'HIGH'
        ? [
            {
              id: 'flexible-spot',
              name: 'Flexible spot-heavy',
              contractMix: { spotPct: 55, shortTermPct: 30, mediumTermPct: 15 },
              riskProfile: { freight: 'HIGH', port: 'MEDIUM', vessel: 'HIGH' },
              bestIf:
                'Best if you expect rates to soften and can absorb timing risk.',
            },
            {
              id: 'short-flex',
              name: 'Short-term flexibility',
              contractMix: { spotPct: 35, shortTermPct: 45, mediumTermPct: 20 },
              riskProfile: { freight: 'HIGH', port: 'MEDIUM', vessel: 'MEDIUM' },
              bestIf:
                'Best if cargo windows are uncertain and you need optionality.',
            },
            {
              id: 'opportunistic',
              name: 'Opportunistic multi-voyage',
              contractMix: { spotPct: 40, shortTermPct: 40, mediumTermPct: 20 },
              riskProfile: { freight: 'MEDIUM', port: 'HIGH', vessel: 'HIGH' },
              bestIf:
                'Best if you can roll voyages and chase spot discounts.',
            },
          ]
        : [
            {
              id: 'balanced-multi',
              name: 'Balanced multi-voyage',
              contractMix: { spotPct: 25, shortTermPct: 35, mediumTermPct: 40 },
              riskProfile: { freight: 'MEDIUM', port: 'MEDIUM', vessel: 'MEDIUM' },
              bestIf:
                'Best if scenario spread is moderate and you want retained flexibility.',
            },
            {
              id: 'protected-flex',
              name: 'Protected with flexibility',
              contractMix: { spotPct: 20, shortTermPct: 40, mediumTermPct: 40 },
              riskProfile: { freight: 'MEDIUM', port: 'MEDIUM', vessel: 'LOW' },
              bestIf:
                'Best if you want medium-term cover without locking all tonnage.',
            },
            {
              id: 'spot-tilt',
              name: 'Mild spot tilt',
              contractMix: { spotPct: 35, shortTermPct: 35, mediumTermPct: 30 },
              riskProfile: { freight: 'MEDIUM', port: 'MEDIUM', vessel: 'HIGH' },
              bestIf:
                'Best if near-term availability looks adequate and rates may ease.',
            },
          ]

  return templates.map((t) => {
    const c = costFor(t.contractMix)
    return {
      ...t,
      baseCostUsd: c.base,
      lowCostUsd: c.low,
      highCostUsd: c.high,
    }
  })
}
