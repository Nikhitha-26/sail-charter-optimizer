import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { isVesselCompatible, normalizeRisk } from '../lib/constants'
import { useDecisionContext } from '../store/decisionContext'
import type { PortsResponse, Vessel, VesselsResponse } from '../types/api'
import AnalysisMapLayout, {
  useMapOpen,
} from '../components/layout/AnalysisMapLayout'
import ContextMapPanel from '../components/map/ContextMapPanel'
import {
  ErrorPanel,
  LoadingSkeleton,
  PrototypeBadge,
} from '../components/ui/Status'

export default function Vessels() {
  const ctx = useDecisionContext()
  const { isMapOpen, onToggleMap } = useMapOpen()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [ports, setPorts] = useState<PortsResponse['ports']>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vRes, pRes] = await Promise.all([
        api.vessels() as Promise<VesselsResponse>,
        api.ports() as Promise<PortsResponse>,
      ])
      setVessels(vRes.vessels ?? [])
      setPorts(pRes.ports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vessels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = vessels.find((v) => v.vessel_id === selectedId) ?? null

  const compatiblePortIds = useMemo(() => {
    if (!selected) return undefined
    return ports
      .filter((p) => isVesselCompatible(selected, p))
      .map((p) => p.port_id)
  }, [selected, ports])

  if (loading && !vessels.length) {
    return (
      <section>
        <p className="eyebrow">VESSEL INTELLIGENCE</p>
        <h2>Loading vessels...</h2>
        <LoadingSkeleton rows={4} />
      </section>
    )
  }

  if (error && !vessels.length) {
    return (
      <section>
        <p className="eyebrow">VESSEL INTELLIGENCE</p>
        <h2>Unable to load vessels</h2>
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
          highlightedPortIds={compatiblePortIds}
        />
      }
    >
      <section className="page-section">
        <p className="eyebrow">VESSEL INTELLIGENCE</p>
        <h2>Fleet profiles</h2>
        <p className="intro">
          Representative vessel classes for East Coast India coal routes. Select
          a vessel to highlight ports that satisfy draft, LOA and beam limits.
        </p>
        <p className="inline-note">
          <PrototypeBadge text="Representative prototype profiles" />
        </p>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>DWT (MT)</th>
                <th>Draft (m)</th>
                <th>LOA (m)</th>
                <th>Beam (m)</th>
                <th>Speed (kn)</th>
                <th>Compatibility</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => {
                const compatibleCount = ports.filter((p) =>
                  isVesselCompatible(v, p),
                ).length
                const active = selectedId === v.vessel_id
                return (
                  <tr
                    key={v.vessel_id}
                    className={active ? 'row-active' : ''}
                    onClick={() => {
                      setSelectedId(v.vessel_id)
                      ctx.setContext({ vesselType: v.vessel_type })
                    }}
                  >
                    <td>{v.vessel_id}</td>
                    <td>{v.vessel_type}</td>
                    <td>{v.dwt_mt.toLocaleString()}</td>
                    <td>{v.draft_m.toFixed(1)}</td>
                    <td>{v.loa_m}</td>
                    <td>{v.beam_m}</td>
                    <td>{v.speed_knots}</td>
                    <td>
                      {compatibleCount}/{ports.length} ports
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="panel-card">
            <p className="eyebrow">SELECTED</p>
            <h3>
              {selected.vessel_id} · {selected.vessel_type}
            </h3>
            <p>
              Capacity {selected.cargo_capacity_mt.toLocaleString()} MT · Fuel
              laden {selected.fuel_consumption_laden_mt_day} MT/day
            </p>
            <p className="muted">
              Compatible ports highlighted on the map (
              {compatiblePortIds?.length ?? 0} of {ports.length}).
            </p>
          </div>
        )}
      </section>
    </AnalysisMapLayout>
  )
}
