import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import DecisionContextBar from './components/layout/DecisionContextBar'
import { BackendBanner } from './components/ui/Status'
import { BackendStatusProvider } from './lib/hooks'

import Dashboard from './pages/Dashboard'
import Forecast from './pages/Forecast'
import Optimizer from './pages/Optimizer'
import Vessels from './pages/Vessels'
import Ports from './pages/Ports'
import Risk from './pages/Risk'
import Decisions from './pages/Decisions'

import './App.css'

function App() {
  return (
    <BackendStatusProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Sidebar />

          <main className="main-content">
            <Topbar />
            <BackendBanner />
            <DecisionContextBar />

            <section className="page-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/optimizer" element={<Optimizer />} />
                <Route path="/vessels" element={<Vessels />} />
                <Route path="/ports" element={<Ports />} />
                <Route path="/risk" element={<Risk />} />
                <Route path="/decisions" element={<Decisions />} />
              </Routes>
            </section>
          </main>
        </div>
      </BrowserRouter>
    </BackendStatusProvider>
  )
}

export default App
