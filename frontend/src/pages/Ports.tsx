import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { congestionToRisk, normalizeRisk } from '../lib/constants'
import { useDecisionContext } from '../store/decisionContext'
import type { Port, PortsResponse, Vessel, VesselsResponse } from '../types/api'
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

export default function Ports() {
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()
  const [ports, setPorts] = useState<Port[]>([])
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, vRes] = await Promise.all([
        api.ports() as Promise<PortsResponse>,
        api.vessels() as Promise<VesselsResponse>,
      ])
      setPorts(pRes.ports ?? [])
      setVessels(vRes.vessels ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !ports.length) {
    return (
      <section>
        <p className="eyebrow">PORTS & CONSTRAINTS</p>
        <h2>Loading ports...</h2>
        <LoadingSkeleton rows={4} />
      </section>
    )
  }

  if (error && !ports.length) {
    return (
      <section>
        <p className="eyebrow">PORTS & CONSTRAINTS</p>
        <h2>Unable to load ports</h2>
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
          vessels={vessels}
          riskLevel={normalizeRisk('MEDIUM')}
          selectedPortId={selectedPortId}
          onSelectedPortChange={setSelectedPortId}
          highlightedPortIds={ports.map((p) => p.port_id)}
        />
      }
    >
      <section className="page-section">
        <p className="eyebrow">PORTS & CONSTRAINTS</p>
        <h2>East Coast India ports</h2>
        <p className="intro">
          Physical constraints and baseline congestion for discharge options.
          Click a row to open port details on the map panel.
        </p>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Max draft (m)</th>
                <th>Max LOA (m)</th>
                <th>Max beam (m)</th>
                <th>Congestion</th>
                <th>Risk</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => {
                const risk = congestionToRisk(p.baseline_congestion_index)
                const active = selectedPortId === p.port_id
                return (
                  <tr
                    key={p.port_id}
                    className={active ? 'row-active' : ''}
                    onClick={() => {
                      setSelectedPortId(p.port_id)
                      ctx.setContext({ destination: p.port_id })
                    }}
                  >
                    <td>
                      <strong>{p.port_name}</strong>
                      <div className="muted tiny">{p.port_id}</div>
                    </td>
                    <td>{p.max_draft_m.toFixed(1)}</td>
                    <td>{p.max_loa_m}</td>
                    <td>{p.max_beam_m}</td>
                    <td>{p.baseline_congestion_index.toFixed(2)}</td>
                    <td>
                      <RiskPill level={risk} />
                    </td>
                    <td>
                      {p.source.includes('PROTOTYPE') ? (
                        <PrototypeBadge text="Estimate" />
                      ) : (
                        <span className="muted tiny">Official</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AnalysisMapLayout>
  )
}
