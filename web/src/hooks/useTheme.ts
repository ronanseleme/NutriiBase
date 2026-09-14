import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'nutribase.theme'

function readStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Preferência de tema é só do dispositivo (localStorage), não da conta —
// evita precisar de uma coluna nova no Supabase só pra isso. O <html> já
// recebe o data-theme certo antes do primeiro paint via script inline no
// index.html; este hook só mantém o estado em sincronia pra alternar em
// tempo real e persistir a escolha.
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage indisponível (modo privado etc.) — só não persiste
    }
  }, [])

  return { theme, setTheme }
}
