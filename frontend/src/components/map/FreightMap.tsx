import { useMemo, useState } from 'react'
import type { Port, RiskLevel } from '../../types/api'
import { congestionToRisk, riskColor } from '../../lib/constants'

/** Approximate SVG coordinates for prototype trade-lane map (viewBox 0 0 640 420). */
const PORT_COORDS: Record<string, { x: number; y: number; label: string }> = {
  Newcastle_Australia: { x: 560, y: 310, label: 'Newcastle' },
  Gladstone_Australia: { x: 545, y: 275, label: 'Gladstone' },
  Hay_Point_Australia: { x: 535, y: 255, label: 'Hay Point' },
  Haldia: { x: 195, y: 95, label: 'Haldia' },
  Sagar_Sandheads: { x: 205, y: 110, label: 'Sagar' },
  Dhamra: { x: 215, y: 145, label: 'Dhamra' },
  Paradip: { x: 220, y: 165, label: 'Paradip' },
  Gopalpur: { x: 218, y: 190, label: 'Gopalpur' },
  Gangavaram: { x: 210, y: 225, label: 'Gangavaram' },
  Visakhapatnam: { x: 205, y: 245, label: 'Vizag' },
}

const INDIA_PORTS = [
  'Haldia',
  'Sagar_Sandheads',
  'Dhamra',
  'Paradip',
  'Gopalpur',
  'Gangavaram',
  'Visakhapatnam',
] as const

interface FreightMapProps {
  origin: string
  destination: string
  ports: Port[]
  riskLevel: RiskLevel
  highlightedPortIds?: string[]
  selectedPortId?: string | null
  onPortClick?: (portId: string) => void
  compact?: boolean
  className?: string
}

function quadraticPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const cx = (x1 + x2) / 2
  const cy = Math.min(y1, y2) - 55
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

export default function FreightMap({
  origin,
  destination,
  ports,
  riskLevel,
  highlightedPortIds,
  selectedPortId,
  onPortClick,
  compact = false,
  className = '',
}: FreightMapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  const portById = useMemo(() => {
    const map = new Map<string, Port>()
    for (const p of ports) map.set(p.port_id, p)
    return map
  }, [ports])

  const originPt = PORT_COORDS[origin] ?? PORT_COORDS.Newcastle_Australia
  const destPt = PORT_COORDS[destination] ?? PORT_COORDS.Paradip
  const laneColor = riskColor(riskLevel)
  const highlightSet = highlightedPortIds ? new Set(highlightedPortIds) : null

  const hoverPort = hoverId ? portById.get(hoverId) : null
  const hoverCoord = hoverId ? PORT_COORDS[hoverId] : null

  return (
    <div className={`freight-map ${compact ? 'compact' : ''} ${className}`}>
      <svg
        viewBox="0 0 640 420"
        role="img"
        aria-label="Prototype trade-lane map Australia to East Coast India"
      >
        {/* Ocean wash */}
        <rect x="0" y="0" width="640" height="420" fill="#e8f0ee" />

        {/* Stylized Indian Ocean / Bay of Bengal */}
        <ellipse cx="320" cy="220" rx="280" ry="160" fill="#d9e8e4" opacity="0.7" />

        {/* Australia (simplified east coast focus) */}
        <path
          d="M 480 180
             C 500 160, 540 170, 570 200
             C 590 230, 600 280, 585 330
             C 570 370, 530 380, 500 360
             C 470 340, 460 290, 465 250
             C 468 220, 470 195, 480 180 Z"
          fill="#ddd6c8"
          stroke="#b8b09f"
          strokeWidth="1.2"
        />

        {/* East India landmass (simplified) */}
        <path
          d="M 120 40
             C 160 50, 190 70, 200 100
             C 210 140, 225 180, 220 220
             C 215 270, 200 310, 175 340
             C 150 360, 110 350, 95 320
             C 85 280, 90 220, 95 160
             C 100 100, 105 60, 120 40 Z"
          fill="#ddd6c8"
          stroke="#b8b09f"
          strokeWidth="1.2"
        />

        {/* Coastline accent */}
        <path
          d="M 195 70 C 210 110, 225 155, 220 200 C 215 250, 205 290, 185 325"
          fill="none"
          stroke="#a89f8e"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        <path
          d="M 520 200 C 545 230, 560 270, 555 320"
          fill="none"
          stroke="#a89f8e"
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        {/* Trade lane */}
        <path
          d={quadraticPath(originPt.x, originPt.y, destPt.x, destPt.y)}
          fill="none"
          stroke={laneColor}
          strokeWidth={compact ? 2 : 2.5}
          strokeLinecap="round"
          opacity={0.85}
        />
        {/* Directional dash overlay */}
        <path
          d={quadraticPath(originPt.x, originPt.y, destPt.x, destPt.y)}
          fill="none"
          stroke="#faf8f3"
          strokeWidth={1}
          strokeDasharray="6 8"
          opacity={0.6}
        />

        {/* Australia origin marker */}
        <circle
          cx={originPt.x}
          cy={originPt.y}
          r={compact ? 4 : 5.5}
          fill="#3d4a3c"
          stroke="#faf8f3"
          strokeWidth="1.5"
        />
        {!compact && (
          <text
            x={originPt.x}
            y={originPt.y + 16}
            textAnchor="middle"
            className="map-label"
            fill="#4a463e"
            fontSize="10"
          >
            {originPt.label}
          </text>
        )}

        {/* India ports */}
        {INDIA_PORTS.map((id) => {
          const coord = PORT_COORDS[id]
          if (!coord) return null
          const port = portById.get(id)
          const level = port
            ? congestionToRisk(port.baseline_congestion_index)
            : ('MEDIUM' as RiskLevel)
          const isHighlighted = highlightSet ? highlightSet.has(id) : true
          const isSelected = selectedPortId === id
          const r = isSelected ? 7 : compact ? 3.5 : 5

          return (
            <g
              key={id}
              className="map-port"
              style={{ cursor: onPortClick ? 'pointer' : 'default', opacity: isHighlighted ? 1 : 0.25 }}
              onMouseEnter={() => setHoverId(id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onPortClick?.(id)}
            >
              <circle
                cx={coord.x}
                cy={coord.y}
                r={r + 3}
                fill="transparent"
              />
              <circle
                cx={coord.x}
                cy={coord.y}
                r={r}
                fill={riskColor(level)}
                stroke={isSelected ? '#292824' : '#faf8f3'}
                strokeWidth={isSelected ? 2 : 1.2}
              />
              {!compact && (
                <text
                  x={coord.x - 10}
                  y={coord.y + 4}
                  textAnchor="end"
                  fill="#4a463e"
                  fontSize="9"
                >
                  {coord.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Region labels */}
        {!compact && (
          <>
            <text x="95" y="55" fill="#8a857a" fontSize="9" fontWeight="600">
              EAST COAST INDIA
            </text>
            <text x="500" y="175" fill="#8a857a" fontSize="9" fontWeight="600">
              AUSTRALIA
            </text>
            <text x="300" y="250" fill="#7a9a92" fontSize="10" textAnchor="middle">
              Indian Ocean
            </text>
          </>
        )}
      </svg>

      {hoverPort && hoverCoord && !compact && (
        <div
          className="map-tooltip"
          style={{
            left: `${(hoverCoord.x / 640) * 100}%`,
            top: `${(hoverCoord.y / 420) * 100}%`,
          }}
        >
          <strong>{hoverPort.port_name}</strong>
          <span>
            Congestion:{' '}
            {congestionToRisk(hoverPort.baseline_congestion_index)} (
            {hoverPort.baseline_congestion_index.toFixed(2)})
          </span>
        </div>
      )}

      <p className="map-caption">
        Prototype trade-lane visualization – not a navigational chart.
      </p>
    </div>
  )
}

export { PORT_COORDS, INDIA_PORTS }
