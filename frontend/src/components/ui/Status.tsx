import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useBackendStatus } from '../../lib/hooks'

export function BackendBanner() {
  const { available, checked, lastError, recheck } = useBackendStatus()

  if (!checked || available) return null

  return (
    <div className="backend-banner" role="status">
      <div className="backend-banner-inner">
        <AlertTriangle size={14} strokeWidth={1.8} />
        <span>
          Backend unavailable – some features are limited. Connect to SAIL Freight
          API.
          {lastError ? ` (${lastError})` : ''}
        </span>
        <button type="button" className="banner-retry" onClick={() => void recheck()}>
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ width: `${88 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="error-panel">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          <RefreshCw size={13} />
          Retry
        </button>
      )}
    </div>
  )
}

export function PrototypeBadge({ text = 'Prototype' }: { text?: string }) {
  return <span className="prototype-badge">{text}</span>
}

export function RiskPill({ level }: { level: string }) {
  const normalized = level.toUpperCase()
  const cls =
    normalized === 'LOW'
      ? 'risk-pill low'
      : normalized === 'HIGH'
        ? 'risk-pill high'
        : 'risk-pill medium'
  return <span className={cls}>{normalized}</span>
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="side-drawer">
      <div className="side-drawer-header">
        <h4>{title}</h4>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="side-drawer-body">{children}</div>
    </div>
  )
}
