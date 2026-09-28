import type { Port, RiskLevel, Vessel } from '../types/api'

export const ORIGINS = [
  { value: 'Newcastle_Australia', label: 'Newcastle, Australia' },
  { value: 'Gladstone_Australia', label: 'Gladstone, Australia' },
  { value: 'Hay_Point_Australia', label: 'Hay Point, Australia' },
] as const

export const DESTINATIONS = [
  { value: 'Paradip', label: 'Paradip' },
  { value: 'Visakhapatnam', label: 'Visakhapatnam (Vizag)' },
  { value: 'Gangavaram', label: 'Gangavaram' },
  { value: 'Dhamra', label: 'Dhamra' },
  { value: 'Gopalpur', label: 'Gopalpur' },
  { value: 'Haldia', label: 'Haldia' },
  { value: 'Sagar_Sandheads', label: 'Sagar (Sandheads)' },
] as const

export const VESSEL_TYPES = ['Capesize', 'Panamax', 'Supramax'] as const

export const COMMODITIES = ['Coal', 'Iron Ore', 'Limestone'] as const

export function formatOriginLabel(origin: string): string {
  const found = ORIGINS.find((o) => o.value === origin)
  if (found) return found.label.replace(', Australia', '')
  return origin.replace(/_/g, ' ')
}

export function formatDestinationLabel(destination: string): string {
  const found = DESTINATIONS.find((d) => d.value === destination)
  return found?.label ?? destination.replace(/_/g, ' ')
}

export function formatQuantity(mt: number): string {
  if (mt >= 1_000_000) return `${(mt / 1_000_000).toFixed(1)}M MT`
  if (mt >= 1000) return `${Math.round(mt / 1000)}k MT`
  return `${mt} MT`
}

export function formatWindow(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${start} – ${end}`
  }
  const startLabel = s.toLocaleDateString('en-US', opts)
  const endLabel = e.toLocaleDateString('en-US', opts)
  if (startLabel === endLabel) return startLabel
  // Compact: "Oct–Dec 2026"
  const sm = s.toLocaleDateString('en-US', { month: 'short' })
  const em = e.toLocaleDateString('en-US', { month: 'short' })
  const sy = s.getFullYear()
  const ey = e.getFullYear()
  if (sy === ey) return `${sm}–${em} ${sy}`
  return `${startLabel} – ${endLabel}`
}

export function congestionToRisk(index: number): RiskLevel {
  if (index >= 0.45) return 'HIGH'
  if (index >= 0.35) return 'MEDIUM'
  return 'LOW'
}

export function normalizeRisk(level: string | undefined | null): RiskLevel {
  const u = (level ?? 'MEDIUM').toUpperCase()
  if (u === 'LOW' || u === 'HIGH') return u
  return 'MEDIUM'
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'LOW':
      return '#5a7358'
    case 'MEDIUM':
      return '#b8860b'
    case 'HIGH':
      return '#a0452e'
  }
}

export function isVesselCompatible(vessel: Vessel, port: Port): boolean {
  return (
    vessel.draft_m <= port.max_draft_m + 0.5 &&
    vessel.loa_m <= port.max_loa_m &&
    vessel.beam_m <= port.max_beam_m
  )
}

export function compatibleVesselTypes(
  port: Port,
  vessels: Vessel[],
): string[] {
  const types = new Set<string>()
  for (const v of vessels) {
    if (isVesselCompatible(v, port)) types.add(v.vessel_type)
  }
  return Array.from(types)
}

/** Prototype feature importance for forecast explainability. */
export const FEATURE_IMPORTANCE = [
  { feature: 'rolling_mean_7', importance: 0.22 },
  { feature: 'freight_rate_lag_1', importance: 0.18 },
  { feature: 'rolling_mean_30', importance: 0.14 },
  { feature: 'port_congestion_change', importance: 0.11 },
  { feature: 'bunker_price_index', importance: 0.09 },
  { feature: 'vessel_availability_index', importance: 0.08 },
  { feature: 'seasonal_month', importance: 0.07 },
  { feature: 'route_demand_proxy', importance: 0.06 },
] as const
