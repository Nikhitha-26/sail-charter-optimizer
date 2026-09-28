import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import type {
  DashboardData,
  DecisionData,
  ForecastData,
  ModelPerformance,
  PortsResponse,
  UncertaintyData,
  VesselsResponse,
} from '../types/api'

interface BackendStatus {
  available: boolean
  checked: boolean
  lastError: string | null
  markUnavailable: (message?: string) => void
  markAvailable: () => void
  recheck: () => Promise<void>
}

const BackendStatusContext = createContext<BackendStatus | null>(null)

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(true)
  const [checked, setChecked] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const markUnavailable = useCallback((message?: string) => {
    setAvailable(false)
    setLastError(message ?? 'Backend unavailable')
  }, [])

  const markAvailable = useCallback(() => {
    setAvailable(true)
    setLastError(null)
  }, [])

  const recheck = useCallback(async () => {
    try {
      await api.health()
      markAvailable()
    } catch (err) {
      markUnavailable(err instanceof Error ? err.message : 'Backend unavailable')
    } finally {
      setChecked(true)
    }
  }, [markAvailable, markUnavailable])

  useEffect(() => {
    void recheck()
  }, [recheck])

  return (
    <BackendStatusContext.Provider
      value={{ available, checked, lastError, markUnavailable, markAvailable, recheck }}
    >
      {children}
    </BackendStatusContext.Provider>
  )
}

export function useBackendStatus(): BackendStatus {
  const ctx = useContext(BackendStatusContext)
  if (!ctx) {
    throw new Error('useBackendStatus must be used within BackendStatusProvider')
  }
  return ctx
}

/** Generic async fetch helper with loading/error/retry. */
export function useApiData<T>(fetcher: () => Promise<unknown>, map: (raw: unknown) => T) {
  const { markUnavailable, markAvailable } = useBackendStatus()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await fetcher()
      setData(map(raw))
      markAvailable()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setError(message)
      markUnavailable(message)
    } finally {
      setLoading(false)
    }
  }, [fetcher, map, markAvailable, markUnavailable])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, retry: load }
}

export const fetchDashboard = () => api.dashboard() as Promise<DashboardData>
export const fetchForecast = () => api.forecast() as Promise<ForecastData>
export const fetchDecision = () => api.decision() as Promise<DecisionData>
export const fetchPorts = () => api.ports() as Promise<PortsResponse>
export const fetchVessels = () => api.vessels() as Promise<VesselsResponse>
export const fetchModelPerformance = () =>
  api.modelPerformance() as Promise<ModelPerformance>
export const fetchUncertainty = () => api.uncertainty() as Promise<UncertaintyData>
