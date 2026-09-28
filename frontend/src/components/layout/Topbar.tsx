import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Overview',
  '/forecast': 'Freight Forecast',
  '/optimizer': 'Charter Optimizer',
  '/vessels': 'Vessel Intelligence',
  '/ports': 'Ports & Constraints',
  '/risk': 'Risk & Scenarios',
  '/decisions': 'Decisions',
}

export default function Topbar() {
  const location = useLocation()

  const title = pageTitles[location.pathname] ?? 'Overview'

  return (
    <header className="topbar">
      <div>
        <div className="breadcrumb">SAIL / FREIGHT INTELLIGENCE</div>
        <h1>{title}</h1>
      </div>

      <div className="topbar-meta">
        <span>East Coast India</span>
        <span className="date">27 Sep 2026</span>
      </div>
    </header>
  )
}