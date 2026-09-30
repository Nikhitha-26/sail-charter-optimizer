import {
  formatINRPerTonne,
} from '../lib/currency'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import {
  COMMODITIES,
  DESTINATIONS,
  FEATURE_IMPORTANCE,
  ORIGINS,
  VESSEL_TYPES,
  normalizeRisk,
} from '../lib/constants'
import { useDecisionContext } from '../store/decisionContext'
import type {
  ForecastData,
  ModelPerformance,
  PortsResponse,
} from '../types/api'
import AnalysisMapLayout, {
  useMapOpen,
} from '../components/layout/AnalysisMapLayout'
import ContextMapPanel from '../components/map/ContextMapPanel'
import {
  ErrorPanel,
  LoadingSkeleton,
  PrototypeBadge,
} from '../components/ui/Status'

export default function Forecast() {
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()

  const [form, setForm] = useState({
    origin: ctx.origin,
    destination: ctx.destination,
    vesselType: ctx.vesselType,
    commodity: ctx.commodity,
    horizon: 30 as 7 | 30 | 90,
  })

  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [performance, setPerformance] = useState<ModelPerformance | null>(null)
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelOpen, setModelOpen] = useState(false)
  const [appliedNote, setAppliedNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
  
    try {
      const [f, p, portsRes] = await Promise.all([
        api.forecast({
          origin: ctx.origin,
          destination: ctx.destination,
          vesselType: ctx.vesselType,
          commodity: ctx.commodity,
          horizon: form.horizon,
        }) as Promise<ForecastData>,
  
        api.modelPerformance() as Promise<ModelPerformance>,
  
        api.ports() as Promise<PortsResponse>,
      ])
  
      setForecast(f)
      setPerformance(p)
      setPorts(portsRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast')
    } finally {
      setLoading(false)
    }
  }, [ctx.origin, ctx.destination, ctx.vesselType, ctx.commodity, form.horizon])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(() => {
    if (!forecast) return []
    return forecast.forecast.slice(0, form.horizon).map((row) => ({
      date: row.forecast_date,
      historical: row.forecast_freight_rate,
      base: row.base_scenario,
      low: row.low_scenario,
      high: row.high_scenario,
    }))
  }, [forecast, form.horizon])

  const metrics = useMemo(() => {
    if (!chartData.length) return null
    const last = chartData[chartData.length - 1]
    const first = chartData[0]
    return {
      current: first.historical,
      base: chartData.reduce((s, d) => s + d.base, 0) / chartData.length,
      low: chartData.reduce((s, d) => s + d.low, 0) / chartData.length,
      high: chartData.reduce((s, d) => s + d.high, 0) / chartData.length,
      endBase: last.base,
    }
  }, [chartData])

  const apply = async () => {
    setLoading(true)
    setError(null)
    setAppliedNote(null)
  
    try {
      const forecastResult = await api.forecast({
        origin: form.origin,
        destination: form.destination,
        vesselType: form.vesselType,
        commodity: form.commodity,
        horizon: form.horizon,
      }) as ForecastData
  
      setForecast(forecastResult)
  
      ctx.setContext({
        origin: form.origin,
        destination: form.destination,
        vesselType: form.vesselType,
        commodity: form.commodity,
      })
  
      setAppliedNote(
        `Forecast generated for ${form.origin.replace(
          /_/g,
          ' ',
        )} → ${form.destination.replace(
          /_/g,
          ' ',
        )} • ${form.vesselType} • ${form.horizon} days.`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate forecast',
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading && !forecast) {
    return (
      <section>
        <p className="eyebrow">FREIGHT INTELLIGENCE</p>
        <h2>Freight Forecast</h2>
        <LoadingSkeleton rows={5} />
      </section>
    )
  }

  if (error && !forecast) {
    return (
      <section>
        <p className="eyebrow">FREIGHT INTELLIGENCE</p>
        <h2>Freight Forecast</h2>
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
          riskLevel={normalizeRisk('MEDIUM')}
        />
      }
    >
      <section className="page-section">
        <p className="eyebrow">FREIGHT INTELLIGENCE</p>
        <h2>Freight Forecast</h2>
        <p className="intro">
          Scenario bands for the monitored Australia–East Coast India lane.
          Adjust context and horizon to focus the analysis window.
        </p>

        <form
          className="selector-form"
          onSubmit={(e) => {
            e.preventDefault()
            apply()
          }}
        >
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
            Vessel
            <select
              value={form.vesselType}
              onChange={(e) =>
                setForm((f) => ({ ...f, vesselType: e.target.value }))
              }
            >
              {VESSEL_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Commodity
            <select
              value={form.commodity}
              onChange={(e) =>
                setForm((f) => ({ ...f, commodity: e.target.value }))
              }
            >
              {COMMODITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Horizon
            <select
              value={form.horizon}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  horizon: Number(e.target.value) as 7 | 30 | 90,
                }))
              }
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>

        {appliedNote && (
          <p className="inline-note">
            <PrototypeBadge /> {appliedNote}
          </p>
        )}

        {metrics && (
          <div className="metric-row">
            <div className="metric-card">
              <span>Current</span>
              <strong>{formatINRPerTonne(metrics.current)}</strong>
              <small>INR / MT</small>
            </div>
            <div className="metric-card">
              <span>{form.horizon}D Base</span>
              <strong>{formatINRPerTonne(metrics.base)}</strong>
              <small>avg INR / MT</small>
            </div>
            <div className="metric-card">
              <span>Low</span>
              <strong>{formatINRPerTonne(metrics.low)}</strong>
              <small>avg INR / MT</small>
            </div>
            <div className="metric-card">
              <span>High</span>
              <strong>{formatINRPerTonne(metrics.high)}</strong>
              <small>avg INR / MT</small>
            </div>
          </div>
        )}

        <div className="chart-card">
          <p className="eyebrow">RATE SCENARIOS</p>
          <h3>Freight path – base with low/high band</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e4dfd5" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#8a857a' }}
                  tickFormatter={(v: string) => v.slice(5)}
                  minTickGap={28}
                />
                <YAxis
  tick={{ fontSize: 10, fill: '#8a857a' }}
  domain={['auto', 'auto']}
  width={60}
  tickFormatter={(value: number) =>
    `₹${(value * 93).toFixed(0)}`
  }
/>
                <Tooltip
  contentStyle={{
    background: '#faf8f3',
    border: '1px solid #e2ddd3',
    fontSize: 12,
  }}
  formatter={(value) =>
    typeof value === 'number'
      ? formatINRPerTonne(value)
      : String(value ?? '')
  }
/>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="high"
                  stroke="none"
                  fill="#c4b59a"
                  fillOpacity={0.25}
                  name="High band"
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  stroke="none"
                  fill="#f5f2eb"
                  fillOpacity={1}
                  name="Low floor"
                />
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="#5a554c"
                  strokeWidth={1.5}
                  dot={false}
                  name="Point forecast"
                />
                <Line
                  type="monotone"
                  dataKey="base"
                  stroke="#3d5a45"
                  strokeWidth={2}
                  dot={false}
                  name="Base scenario"
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="#8a9a7a"
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Low scenario"
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#a0452e"
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="High scenario"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="accordion">
          <button
            type="button"
            className="accordion-trigger"
            onClick={() => setModelOpen((o) => !o)}
          >
            {modelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Model details
          </button>
          {modelOpen && performance && (
            <div className="accordion-body">
              <div className="metric-row compact">
                <div className="metric-card">
                  <span>Model</span>
                  <strong>{performance.model}</strong>
                </div>
                <div className="metric-card">
                  <span>Test MAE</span>
                  <strong>{performance.mae.toFixed(4)}</strong>
                </div>
                <div className="metric-card">
                  <span>Test RMSE</span>
                  <strong>{performance.rmse.toFixed(4)}</strong>
                </div>
                <div className="metric-card">
                  <span>Baseline MAE</span>
                  <strong>{performance.baseline_mae.toFixed(4)}</strong>
                </div>
                <div className="metric-card">
                  <span>MAE improvement</span>
                  <strong>{performance.improvement_percent.toFixed(2)}%</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="card-title-row">
            <div>
              <p className="eyebrow">EXPLAINABILITY</p>
              <h3>What drives this forecast?</h3>
            </div>
            <PrototypeBadge text="Prototype feature weights" />
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[...FEATURE_IMPORTANCE]}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke="#e4dfd5" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8a857a' }} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={150}
                  tick={{ fontSize: 10, fill: '#5a554c' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#faf8f3',
                    border: '1px solid #e2ddd3',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="importance" fill="#4a5d4c" name="Relative importance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </AnalysisMapLayout>
  )
}
