import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../store/theme'

export default function ThemeToggle() {
  const { mode, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={mode === 'light' ? 'Dark mode' : 'Light mode'}
    >
      {mode === 'light' ? <Moon size={15} strokeWidth={1.7} /> : <Sun size={15} strokeWidth={1.7} />}
    </button>
  )
}
