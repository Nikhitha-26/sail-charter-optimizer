import {
  AlertTriangle,
  Anchor,
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  MapPin,
  Ship,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useBackendStatus } from '../../lib/hooks'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Freight Forecast', path: '/forecast', icon: BarChart3 },
  { label: 'Charter Optimizer', path: '/optimizer', icon: Ship },
  { label: 'Vessel Intelligence', path: '/vessels', icon: Anchor },
  { label: 'Ports & Constraints', path: '/ports', icon: MapPin },
  { label: 'Risk & Scenarios', path: '/risk', icon: AlertTriangle },
  { label: 'Decisions', path: '/decisions', icon: ClipboardCheck },
]

export default function Sidebar() {
  const { available, checked } = useBackendStatus()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">SF</div>

        <div>
          <div className="brand-name">SAIL Freight</div>
          <div className="brand-subtitle">Intelligence Platform</div>
        </div>
      </div>

      <nav className="navigation">
        <div className="nav-section-label">WORKSPACE</div>

        {navigation.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span
            className={`status-dot ${checked && !available ? 'offline' : ''}`}
          />
          <span>
            {!checked
              ? 'Checking API…'
              : available
                ? 'Forecast system online'
                : 'API offline'}
          </span>
        </div>

        <div className="version">Prototype v1.0 · synthetic data</div>
      </div>
    </aside>
  )
}
