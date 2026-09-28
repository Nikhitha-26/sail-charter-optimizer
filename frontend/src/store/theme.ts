import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

function applyThemeClass(mode: ThemeMode) {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'light',

  setMode: (mode) => {
    applyThemeClass(mode)
    localStorage.setItem('sail-theme', mode)
    set({ mode })
  },

  toggle: () => {
    const next = get().mode === 'light' ? 'dark' : 'light'
    get().setMode(next)
  },
}))

/** Call once before React render so first paint matches stored preference. */
export function initThemeFromStorage() {
  const stored = localStorage.getItem('sail-theme')
  const mode: ThemeMode =
    stored === 'light' || stored === 'dark' ? stored : 'light'
  applyThemeClass(mode)
  useTheme.setState({ mode })
}
