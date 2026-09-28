import { useTheme, type ThemeMode } from '../store/theme'

/** Resolved chart colors for the active theme (Recharts needs concrete values for some props). */
export function useChartTheme() {
  const mode = useTheme((s) => s.mode)
  return getChartTheme(mode)
}

export function getChartTheme(mode: ThemeMode) {
  // Prefer live CSS variables when in browser
  if (typeof document !== 'undefined') {
    const s = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      s.getPropertyValue(name).trim() || fallback

    return {
      grid: read('--chart-grid', mode === 'dark' ? '#2a3038' : '#e4dfd5'),
      tick: read('--chart-tick', mode === 'dark' ? '#8a9099' : '#8a857a'),
      line: read('--chart-line', mode === 'dark' ? '#c8c4bc' : '#5a554c'),
      base: read('--accent-chart', mode === 'dark' ? '#7aa38a' : '#3d5a45'),
      band: read('--chart-band', mode === 'dark' ? '#4a5560' : '#c4b59a'),
      low: read('--chart-low', mode === 'dark' ? '#6a8f7a' : '#8a9a7a'),
      high: read('--chart-high', mode === 'dark' ? '#d4886e' : '#a0452e'),
      bar: read('--accent-bar', mode === 'dark' ? '#6a8f7a' : '#4a5d4c'),
      tooltipBg: read('--bg-card', mode === 'dark' ? '#161a1f' : '#faf8f3'),
      tooltipBorder: read('--border-card', mode === 'dark' ? '#2a3038' : '#e2ddd3'),
      tooltipText: read('--text-primary', mode === 'dark' ? '#e5e5e5' : '#292824'),
      areaFloor: read('--bg-primary', mode === 'dark' ? '#0f1215' : '#f5f2eb'),
      yTick: read('--text-secondary', mode === 'dark' ? '#b0b0b0' : '#5a554c'),
    }
  }

  return {
    grid: mode === 'dark' ? '#2a3038' : '#e4dfd5',
    tick: mode === 'dark' ? '#8a9099' : '#8a857a',
    line: mode === 'dark' ? '#c8c4bc' : '#5a554c',
    base: mode === 'dark' ? '#7aa38a' : '#3d5a45',
    band: mode === 'dark' ? '#4a5560' : '#c4b59a',
    low: mode === 'dark' ? '#6a8f7a' : '#8a9a7a',
    high: mode === 'dark' ? '#d4886e' : '#a0452e',
    bar: mode === 'dark' ? '#6a8f7a' : '#4a5d4c',
    tooltipBg: mode === 'dark' ? '#161a1f' : '#faf8f3',
    tooltipBorder: mode === 'dark' ? '#2a3038' : '#e2ddd3',
    tooltipText: mode === 'dark' ? '#e5e5e5' : '#292824',
    areaFloor: mode === 'dark' ? '#0f1215' : '#f5f2eb',
    yTick: mode === 'dark' ? '#b0b0b0' : '#5a554c',
  }
}
