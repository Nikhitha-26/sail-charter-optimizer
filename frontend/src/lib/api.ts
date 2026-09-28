const API_BASE_URL = 'http://127.0.0.1:8000'

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`)

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    )
  }

  return response.json() as Promise<T>
}

export const api = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),

  forecast: () => request('/api/forecast'),
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
