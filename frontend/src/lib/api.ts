const API_BASE_URL = 'http://127.0.0.1:8000'

async function request(endpoint: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`)
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  return response.json() as Promise<unknown>
}

export const api = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),

  forecast: (params?: {
    origin?: string
    destination?: string
    vesselType?: string
    commodity?: string
    horizon?: number
  }) => {
    const search = new URLSearchParams()
    if (params?.origin) search.set('origin', params.origin)
    if (params?.destination) search.set('destination', params.destination)
    if (params?.vesselType) search.set('vessel_type', params.vesselType)
    if (params?.commodity) search.set('commodity', params.commodity)
    if (params?.horizon) search.set('horizon', String(params.horizon))
    return request(`/api/forecast?${search.toString()}`)
  },
  forecastSummary: () => request('/api/forecast/summary'),
  modelPerformance: () => request('/api/model/performance'),
  uncertainty: () => request('/api/uncertainty'),

  vessels: () => request('/api/vessels'),
  ports: () => request('/api/ports'),
  contracts: () => request('/api/contracts'),
  cargo: () => request('/api/cargo'),
  voyages: () => request('/api/voyages'),

  decision: () => request('/api/decision'),
}
