import { useEffect } from 'react'
import { useLocalState } from './hooks'

export type Theme = 'light' | 'dark'

/** Persists the light/dark choice and keeps the `dark` class on <html> in sync with it. */
export function useTheme() {
  const [theme, setTheme] = useLocalState<Theme>('retinex.theme', 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return { theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}
