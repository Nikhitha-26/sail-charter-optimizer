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
            <span className="status-dot" />
            <span>Forecast system online</span>
          </div>
  
          <div className="version">Prototype v1.0</div>
        </div>
      </aside>
    )
  }