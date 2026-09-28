import { useState, type ReactNode } from 'react'
import { Map as MapIcon } from 'lucide-react'

interface AnalysisMapLayoutProps {
  children: ReactNode
  mapContent: ReactNode
  isMapOpen: boolean
  onToggleMap: () => void
}

export default function AnalysisMapLayout({
  children,
  mapContent,
  isMapOpen,
  onToggleMap,
}: AnalysisMapLayoutProps) {
  return (
    <div className="analysis-map-layout">
      <div className="analysis-workspace">{children}</div>

      <button
        type="button"
        className="map-toggle-btn"
        onClick={onToggleMap}
        aria-expanded={isMapOpen}
      >
        <MapIcon size={14} />
        {isMapOpen ? 'Hide map' : 'Show map'}
      </button>

      <aside className={`context-map-pane ${isMapOpen ? 'open' : ''}`}>
        {mapContent}
      </aside>
    </div>
  )
}

/** Convenience hook for map open state (desktop open by default). */
export function useMapOpen(defaultOpen = true) {
  const [isMapOpen, setIsMapOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen
    return window.matchMedia('(min-width: 1100px)').matches ? defaultOpen : false
  })
  return {
    isMapOpen,
    onToggleMap: () => setIsMapOpen((v) => !v),
    setIsMapOpen,
  }
}
