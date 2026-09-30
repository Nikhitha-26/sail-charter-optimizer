/**
 * frontend/src/components/map/FreightMap.tsx
 * Google Maps freight trade-lane map component
 */

import { useMemo, useState } from 'react'
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Polyline,
} from '@vis.gl/react-google-maps'

import type { Port, RiskLevel } from '../../types/api'
import { congestionToRisk, riskColor } from '../../lib/constants'

/**
 * Real geographic coordinates for the prototype ports.
 *
 * These are used only for visualization of the trade lane.
 * They are not navigational coordinates.
 */
const PORT_COORDS: Record<
  string,
  { lat: number; lng: number; label: string }
> = {
  Newcastle_Australia: {
    lat: -32.9283,
    lng: 151.7817,
    label: 'Newcastle',
  },

  Gladstone_Australia: {
    lat: -23.8427,
    lng: 151.2555,
    label: 'Gladstone',
  },

  Hay_Point_Australia: {
    lat: -21.2947,
    lng: 149.3039,
    label: 'Hay Point',
  },

  Haldia: {
    lat: 22.0257,
    lng: 88.0583,
    label: 'Haldia',
  },

  Sagar_Sandheads: {
    lat: 21.6507,
    lng: 88.025,
    label: 'Sagar',
  },

  Dhamra: {
    lat: 20.7844,
    lng: 86.9367,
    label: 'Dhamra',
  },

  Paradip: {
    lat: 20.2644,
    lng: 86.7025,
    label: 'Paradip',
  },

  Gopalpur: {
    lat: 19.2667,
    lng: 84.9167,
    label: 'Gopalpur',
  },

  Gangavaram: {
    lat: 17.6306,
    lng: 83.2197,
    label: 'Gangavaram',
  },

  Visakhapatnam: {
    lat: 17.6868,
    lng: 83.2185,
    label: 'Vizag',
  },
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

function getPortCoords(portId: string) {
  return PORT_COORDS[portId]
}

function createTradeLane(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) {
  /**
   * We deliberately draw our own ocean trade lane instead of using
   * Google Directions/Routes because this is a maritime route.
   *
   * The intermediate points create a visually natural Indian Ocean
   * trade corridor rather than a road-navigation route.
   */

  const midLat = (origin.lat + destination.lat) / 2
  const midLng = (origin.lng + destination.lng) / 2

  return [
    {
      lat: origin.lat,
      lng: origin.lng,
    },
    {
      lat: origin.lat + (midLat - origin.lat) * 0.45,
      lng: origin.lng + (midLng - origin.lng) * 0.25,
    },
    {
      lat: midLat + 2,
      lng: midLng,
    },
    {
      lat: destination.lat + (midLat - destination.lat) * 0.45,
      lng: destination.lng + (midLng - destination.lng) * 0.25,
    },
    {
      lat: destination.lat,
      lng: destination.lng,
    },
  ]
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
    const map = new globalThis.Map<string, Port>()

    for (const p of ports) {
      map.set(p.port_id, p)
    }

    return map
  }, [ports])

  const originPt =
    getPortCoords(origin) ?? getPortCoords('Newcastle_Australia')

  const destPt =
    getPortCoords(destination) ?? getPortCoords('Paradip')

  const laneColor = riskColor(riskLevel)

  const highlightSet = highlightedPortIds
    ? new Set(highlightedPortIds)
    : null

  const hoverPort = hoverId ? portById.get(hoverId) : null
  const hoverCoord = hoverId ? getPortCoords(hoverId) : null

  const tradeLane = useMemo(
    () => createTradeLane(originPt, destPt),
    [originPt, destPt],
  )

  const mapCenter = useMemo(
    () => ({
      lat: (originPt.lat + destPt.lat) / 2,
      lng: (originPt.lng + destPt.lng) / 2,
    }),
    [originPt, destPt],
  )

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div className={`freight-map ${compact ? 'compact' : ''} ${className}`}>
        <div className="map-error">
          <strong>Google Maps API key missing</strong>
          <p>
            Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env and restart
            the Vite development server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`freight-map ${compact ? 'compact' : ''} ${className}`}
    >
      <APIProvider apiKey={apiKey}>
      <GoogleMap
        defaultCenter={mapCenter}
      defaultZoom={3}
      mapId="DEMO_MAP_ID"
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={true}
      zoomControl={true}
      style={{
        width: '100%',
        height: compact ? '320px' : '460px',
        borderRadius: '12px',
      }}>
          {/* Main ocean freight lane */}
          <Polyline
            path={tradeLane}
            strokeColor={laneColor}
            strokeOpacity={0.9}
            strokeWeight={compact ? 3 : 4}
            geodesic={true}
          />

          {/* Origin marker */}
          <AdvancedMarker
            position={originPt}
            title={`Origin: ${originPt.label}`}
          >
            <div
              className="freight-map-marker freight-map-marker-origin"
              title={originPt.label}
            >
              <span className="marker-dot" />
            </div>
          </AdvancedMarker>

          {/* Destination marker */}
          <AdvancedMarker
            position={destPt}
            title={`Destination: ${destPt.label}`}
          >
            <div
              className="freight-map-marker freight-map-marker-destination"
              title={destPt.label}
            >
              <span className="marker-dot" />
            </div>
          </AdvancedMarker>

          {/* East Coast India port markers */}
          {INDIA_PORTS.map((id) => {
            const coord = getPortCoords(id)

            if (!coord) return null

            const port = portById.get(id)

            const level = port
              ? congestionToRisk(port.baseline_congestion_index)
              : ('MEDIUM' as RiskLevel)

            const isHighlighted = highlightSet
              ? highlightSet.has(id)
              : true

            const isSelected = selectedPortId === id
            const markerColor = riskColor(level)

            return (
              <AdvancedMarker
                key={id}
                position={coord}
                title={coord.label}
                onClick={() => onPortClick?.(id)}
              >
                <div
                  className="freight-map-port-marker"
                  style={{
                    opacity: isHighlighted ? 1 : 0.3,
                    cursor: onPortClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={() => setHoverId(id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <span
                    className="freight-map-port-dot"
                    style={{
                      backgroundColor: markerColor,
                      borderColor: isSelected
                        ? '#292824'
                        : '#ffffff',
                      width: isSelected ? 16 : 11,
                      height: isSelected ? 16 : 11,
                    }}
                  />

                  {!compact && (
                    <span className="freight-map-port-label">
                      {coord.label}
                    </span>
                  )}
                </div>
              </AdvancedMarker>
            )
          })}

          {/* Port information popup */}
          {hoverPort && hoverCoord && !compact && (
            <InfoWindow
              position={hoverCoord}
              onCloseClick={() => setHoverId(null)}
            >
              <div className="google-map-tooltip">
                <strong>{hoverPort.port_name}</strong>

                <span>
                  Congestion:{' '}
                  {congestionToRisk(
                    hoverPort.baseline_congestion_index,
                  )}{' '}
                  (
                  {hoverPort.baseline_congestion_index.toFixed(2)})
                </span>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </APIProvider>

      <p className="map-caption">
        Maritime trade-lane visualization using geographic port
        coordinates. Route line is a prototype trade corridor, not a
        navigational route.
      </p>
    </div>
  )
}

export { PORT_COORDS, INDIA_PORTS }