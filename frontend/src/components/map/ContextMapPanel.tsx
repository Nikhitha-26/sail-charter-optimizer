/**frontend/src/components/map/ContextMapPanel.tsx Context map panel component */

import { useEffect, useMemo, useState } from 'react'
import type { DecisionContextState } from '../../store/decisionContext'
import type { Port, RiskLevel, Vessel } from '../../types/api'
import {
  compatibleVesselTypes,
  congestionToRisk,
  normalizeRisk,
} from '../../lib/constants'
import { api } from '../../lib/api'
import FreightMap from './FreightMap'
import { Drawer, RiskPill } from '../ui/Status'

interface ContextMapPanelProps {
  decisionContext: Pick<
    DecisionContextState,
    'origin' | 'destination' | 'vesselType'
  >
  ports: Port[]
  riskLevel: RiskLevel
  vessels?: Vessel[]
  highlightedPortIds?: string[]
  /** Controlled selection (e.g. from Ports page). */
  selectedPortId?: string | null
  onSelectedPortChange?: (portId: string | null) => void
  compact?: boolean
}

export default function ContextMapPanel({
  decisionContext,
  ports,
  riskLevel,
  vessels: vesselsProp,
  highlightedPortIds,
  selectedPortId: controlledId,
  onSelectedPortChange,
  compact = false,
}: ContextMapPanelProps) {
  const [internalId, setInternalId] = useState<string | null>(null)
  const [vessels, setVessels] = useState<Vessel[]>(vesselsProp ?? [])

  const selectedPortId =
    controlledId !== undefined ? controlledId : internalId

  const setSelectedPortId = (id: string | null) => {
    if (onSelectedPortChange) onSelectedPortChange(id)
    else setInternalId(id)
  }

  useEffect(() => {
    if (vesselsProp) {
      setVessels(vesselsProp)
      return
    }
    // Prototype fallback: fetch vessels once for compatibility notes
    let cancelled = false
    api
      .vessels()
      .then((raw) => {
        if (cancelled) return
        const res = raw as { vessels: Vessel[] }
        setVessels(res.vessels ?? [])
      })
      .catch(() => {
        /* ignore – drawer still shows port constraints */
      })
    return () => {
      cancelled = true
    }
  }, [vesselsProp])

  const selectedPort = useMemo(
    () => ports.find((p) => p.port_id === selectedPortId) ?? null,
    [ports, selectedPortId],
  )

  const compatible = selectedPort
    ? compatibleVesselTypes(selectedPort, vessels)
    : []

  return (
    <div className="context-map-panel">
      <div className="context-map-header">
        <p className="eyebrow">TRADE LANE</p>
        <h3>
          {decisionContext.origin.replace(/_/g, ' ')} →{' '}
          {decisionContext.destination.replace(/_/g, ' ')}
        </h3>
        <RiskPill level={normalizeRisk(riskLevel)} />
      </div>

      <FreightMap
        origin={decisionContext.origin}
        destination={decisionContext.destination}
        ports={ports}
        riskLevel={normalizeRisk(riskLevel)}
        highlightedPortIds={highlightedPortIds}
        selectedPortId={selectedPortId}
        onPortClick={(id) => setSelectedPortId(id)}
        compact={compact}
      />

      <Drawer
        open={!!selectedPort}
        title={selectedPort?.port_name ?? 'Port'}
        onClose={() => setSelectedPortId(null)}
      >
        {selectedPort && (
          <div className="port-detail">
            <dl>
              <div>
                <dt>Max draft</dt>
                <dd>{selectedPort.max_draft_m} m</dd>
              </div>
              <div>
                <dt>Max LOA</dt>
                <dd>{selectedPort.max_loa_m} m</dd>
              </div>
              <div>
                <dt>Max beam</dt>
                <dd>{selectedPort.max_beam_m} m</dd>
              </div>
              <div>
                <dt>Congestion</dt>
                <dd>
                  <RiskPill
                    level={congestionToRisk(selectedPort.baseline_congestion_index)}
                  />{' '}
                  <span className="muted">
                    index {selectedPort.baseline_congestion_index.toFixed(2)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Berths</dt>
                <dd>{selectedPort.berth_count}</dd>
              </div>
              <div>
                <dt>Handling rate</dt>
                <dd>{selectedPort.cargo_handling_rate_tph.toLocaleString()} tph</dd>
              </div>
            </dl>

            <div className="port-compat">
              <p className="eyebrow">COMPATIBLE VESSEL TYPES</p>
              {compatible.length > 0 ? (
                <p>{compatible.join(', ')}</p>
              ) : (
                <p className="muted">
                  Compatibility derived from draft/LOA/beam vs port limits
                  (prototype).
                </p>
              )}
            </div>

            <p className="source-note">Source: {selectedPort.source}</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
