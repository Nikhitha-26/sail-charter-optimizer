import { useEffect, useState } from 'react'
import {
  Anchor,
  CalendarRange,
  MapPin,
  Package,
  RotateCcw,
  Ship,
} from 'lucide-react'
import { useDecisionContext } from '../../store/decisionContext'
import {
  COMMODITIES,
  DESTINATIONS,
  formatDestinationLabel,
  formatOriginLabel,
  formatQuantity,
  formatWindow,
  ORIGINS,
  VESSEL_TYPES,
} from '../../lib/constants'

export default function DecisionContextBar() {
  const ctx = useDecisionContext()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    origin: ctx.origin,
    destination: ctx.destination,
    vesselType: ctx.vesselType,
    commodity: ctx.commodity,
    quantityMt: ctx.quantityMt,
    windowStart: ctx.windowStart,
    windowEnd: ctx.windowEnd,
  })

  useEffect(() => {
    if (!editing) {
      setDraft({
        origin: ctx.origin,
        destination: ctx.destination,
        vesselType: ctx.vesselType,
        commodity: ctx.commodity,
        quantityMt: ctx.quantityMt,
        windowStart: ctx.windowStart,
        windowEnd: ctx.windowEnd,
      })
    }
  }, [
    ctx.origin,
    ctx.destination,
    ctx.vesselType,
    ctx.commodity,
    ctx.quantityMt,
    ctx.windowStart,
    ctx.windowEnd,
    editing,
  ])

  const summary = `${formatOriginLabel(ctx.origin)} → ${formatDestinationLabel(ctx.destination)} | ${ctx.vesselType} | ${ctx.commodity} | ${formatQuantity(ctx.quantityMt)} | ${formatWindow(ctx.windowStart, ctx.windowEnd)}`

  const apply = () => {
    ctx.setContext({
      origin: draft.origin,
      destination: draft.destination,
      vesselType: draft.vesselType,
      commodity: draft.commodity,
      quantityMt: Number(draft.quantityMt) || 0,
      windowStart: draft.windowStart,
      windowEnd: draft.windowEnd,
    })
    setEditing(false)
  }

  const reset = () => {
    ctx.resetToDefault()
    setEditing(false)
  }

  return (
    <div className="decision-context-bar">
      {!editing ? (
        <div className="dcb-summary">
          <div className="dcb-summary-text">
            <MapPin size={13} strokeWidth={1.8} />
            <span>{summary}</span>
          </div>
          <div className="dcb-actions">
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              Edit context
            </button>
            <button type="button" className="btn-ghost" onClick={reset}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="dcb-editor">
          <label>
            <MapPin size={12} />
            Origin
            <select
              value={draft.origin}
              onChange={(e) => setDraft((d) => ({ ...d, origin: e.target.value }))}
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <Anchor size={12} />
            Destination
            <select
              value={draft.destination}
              onChange={(e) => setDraft((d) => ({ ...d, destination: e.target.value }))}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <Ship size={12} />
            Vessel
            <select
              value={draft.vesselType}
              onChange={(e) => setDraft((d) => ({ ...d, vesselType: e.target.value }))}
            >
              {VESSEL_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label>
            <Package size={12} />
            Commodity
            <select
              value={draft.commodity}
              onChange={(e) => setDraft((d) => ({ ...d, commodity: e.target.value }))}
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
              min={1000}
              step={1000}
              value={draft.quantityMt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, quantityMt: Number(e.target.value) }))
              }
            />
          </label>

          <label>
            <CalendarRange size={12} />
            Window start
            <input
              type="date"
              value={draft.windowStart}
              onChange={(e) => setDraft((d) => ({ ...d, windowStart: e.target.value }))}
            />
          </label>

          <label>
            Window end
            <input
              type="date"
              value={draft.windowEnd}
              onChange={(e) => setDraft((d) => ({ ...d, windowEnd: e.target.value }))}
            />
          </label>

          <div className="dcb-editor-actions">
            <button type="button" className="btn-primary" onClick={apply}>
              Apply
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn-ghost" onClick={reset}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
