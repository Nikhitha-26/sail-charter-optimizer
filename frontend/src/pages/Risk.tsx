/**frontend/src/pages/Risk.tsx Risk page*/
import { formatINR, formatINRPerTonne } from '../lib/currency'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { normalizeRisk, riskColor } from '../lib/constants'
import { useDecisionContext } from '../store/decisionContext'
import type {
  DecisionData,
  PortsResponse,
  RiskLevel,
  UncertaintyData,
} from '../types/api'
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

interface ScenarioView {
  id: 'LOW' | 'BASE' | 'HIGH'
  freight: number
  voyageCost: number
  exposure: number
  idleRisk: RiskLevel
}

interface WhatIf {
  freightUp: boolean
  congestionDays: boolean
  vesselTight: boolean
}

export default function Risk() {
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()
  const [decision, setDecision] = useState<DecisionData | null>(null)
  const [uncertainty, setUncertainty] = useState<UncertaintyData | null>(null)
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [whatIf, setWhatIf] = useState<WhatIf>({
    freightUp: false,
    congestionDays: false,
    vesselTight: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dec, unc, portsRes] = await Promise.all([
        api.decision() as Promise<DecisionData>,
        api.uncertainty() as Promise<UncertaintyData>,
        api.ports() as Promise<PortsResponse>,
      ])
      setDecision(dec)
      setUncertainty(unc)
      setPorts(portsRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load risk data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const qty = ctx.quantityMt || 500000

  const scenarios = useMemo((): ScenarioView[] => {
    if (!decision) return []
    const m = decision.market
    let low = m.low_freight_usd_per_mt
    let base = m.base_freight_usd_per_mt
    let high = m.high_freight_usd_per_mt

    if (whatIf.freightUp) {
      low *= 1.2
      base *= 1.2
      high *= 1.2
    }

    const congestionMult = whatIf.congestionDays ? 1.08 : 1
    const vesselIdleBump = whatIf.vesselTight

    const idleFor = (level: RiskLevel): RiskLevel => {
      if (vesselIdleBump || whatIf.congestionDays) {
        if (level === 'LOW') return 'MEDIUM'
        if (level === 'MEDIUM') return 'HIGH'
        return 'HIGH'
      }
      return level
    }

    return [
      {
        id: 'LOW',
        freight: low,
        voyageCost: low * qty * congestionMult,
        exposure: (base - low) * qty,
        idleRisk: idleFor('LOW'),
      },
      {
        id: 'BASE',
        freight: base,
        voyageCost: base * qty * congestionMult,
        exposure: m.scenario_spread_pct * 0.01 * base * qty,
        idleRisk: idleFor(normalizeRisk(m.risk_level)),
      },
      {
        id: 'HIGH',
        freight: high,
        voyageCost: high * qty * congestionMult,
        exposure: (high - base) * qty,
        idleRisk: idleFor('HIGH'),
      },
    ]
  }, [decision, qty, whatIf])

  const mapRisk = useMemo((): RiskLevel => {
    let level = normalizeRisk(decision?.market.risk_level)
    const active =
      Number(whatIf.freightUp) +
      Number(whatIf.congestionDays) +
      Number(whatIf.vesselTight)
    if (active >= 2) level = 'HIGH'
    else if (active === 1 && level === 'LOW') level = 'MEDIUM'
    else if (active === 1 && level === 'MEDIUM') level = 'HIGH'
    return level
  }, [decision, whatIf])

  const matrixCell = useMemo(() => {
    // Probability vs Impact for current what-if state
    const active =
      Number(whatIf.freightUp) +
      Number(whatIf.congestionDays) +
      Number(whatIf.vesselTight)
    const prob = active === 0 ? 1 : active === 1 ? 2 : 3 // 1=L 2=M 3=H
    const impact =
      mapRisk === 'LOW' ? 1 : mapRisk === 'MEDIUM' ? 2 : 3
    return { prob, impact }
  }, [whatIf, mapRisk])

  if (loading && !decision) {
    return (
      <section>
        <p className="eyebrow">RISK & SCENARIOS</p>
        <h2>Loading scenarios...</h2>
        <LoadingSkeleton rows={4} />
      </section>
    )
  }

  if (error && !decision) {
    return (
      <section>
        <p className="eyebrow">RISK & SCENARIOS</p>
        <h2>Unable to load risk data</h2>
        <ErrorPanel message={error} onRetry={() => void load()} />
      </section>
    )
  }

  return (
    <AnalysisMapLayout
      isMapOpen={isMapOpen}
      onToggleMap={onToggleMap}
      mapContent={
        <ContextMapPanel
          decisionContext={ctx}
          ports={ports}
          riskLevel={mapRisk}
        />
      }
    >
      <section className="page-section">
        <p className="eyebrow">RISK & SCENARIOS</p>
        <h2>Scenario exposure</h2>
        <p className="intro">
          Compare LOW / BASE / HIGH freight outcomes for the current cargo
          window. Toggle stressors to stress-test voyage cost and idle risk.
        </p>

        <div className="whatif-panel">
          <p className="eyebrow">WHAT-IF STRESSORS</p>
          <div className="whatif-toggles">
            <Toggle
              label="Freight +20%"
              checked={whatIf.freightUp}
              onChange={(v) => setWhatIf((w) => ({ ...w, freightUp: v }))}
            />
            <Toggle
              label="Congestion +7 days"
              checked={whatIf.congestionDays}
              onChange={(v) => setWhatIf((w) => ({ ...w, congestionDays: v }))}
            />
            <Toggle
              label="Vessel availability −15%"
              checked={whatIf.vesselTight}
              onChange={(v) => setWhatIf((w) => ({ ...w, vesselTight: v }))}
            />
          </div>
          <p className="inline-note">
            <PrototypeBadge /> Stressors apply simple multipliers for illustration
            – not a full risk model.
          </p>
        </div>

        <div className="scenario-grid">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="scenario-card"
              style={{ borderTopColor: riskColor(s.id === 'BASE' ? mapRisk : s.id) }}
            >
              <div className="scenario-card-head">
                <h3>{s.id}</h3>
                <RiskPill level={s.id === 'BASE' ? mapRisk : s.id} />
              </div>
              <dl>
                <div>
                  <dt>Freight</dt>
                  <dd>{formatINRPerTonne(s.freight)}</dd>
                </div>
                <div>
                  <dt>Voyage cost</dt>
                  <dd>{formatINR(s.voyageCost)}</dd>
                </div>
                <div>
                  <dt>Exposure</dt>
                  <dd>{formatINR(s.exposure)}</dd>
                </div>
                <div>
                  <dt>Idle risk</dt>
                  <dd>
                    <RiskPill level={s.idleRisk} />
                  </dd>
                </div>
              </dl>
              <p className="muted tiny">
                Cost ≈ rate × {qty.toLocaleString()} MT
                {whatIf.congestionDays ? ' × congestion uplift' : ''}
              </p>
            </div>
          ))}
        </div>

        <div className="panel-card">
          <p className="eyebrow">RISK MATRIX</p>
          <h3>Probability × Impact</h3>
          <div className="risk-matrix">
            <div className="rm-corner" />
            <div className="rm-axis">Low impact</div>
            <div className="rm-axis">Med impact</div>
            <div className="rm-axis">High impact</div>
            {([3, 2, 1] as const).map((prob) => (
              <Fragment key={`row-${prob}`}>
                <div className="rm-axis-y">
                  {prob === 3 ? 'High' : prob === 2 ? 'Med' : 'Low'} prob
                </div>
                {([1, 2, 3] as const).map((impact) => {
                  const active =
                    matrixCell.prob === prob && matrixCell.impact === impact
                  return (
                    <div
                      key={`${prob}-${impact}`}
                      className={`rm-cell ${active ? 'active' : ''}`}
                    >
                      {active ? 'Current' : ''}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
          <p className="inline-note">
            <PrototypeBadge /> Matrix position updates with what-if toggles.
          </p>
        </div>

        {uncertainty && (
          <div className="panel-card">
            <p className="eyebrow">FORECAST ERROR DISTRIBUTION</p>
            <div className="metric-row compact">
              <div className="metric-card">
                <span>MAE</span>
                <strong>{Number(uncertainty.MAE).toFixed(3)}</strong>
              </div>
              <div className="metric-card">
                <span>RMSE</span>
                <strong>{Number(uncertainty.RMSE).toFixed(3)}</strong>
              </div>
              <div className="metric-card">
                <span>P10 / P90</span>
                <strong>
                  {Number(uncertainty.P10).toFixed(2)} /{' '}
                  {Number(uncertainty.P90).toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>
    </AnalysisMapLayout>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={`toggle-chip ${checked ? 'on' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}
