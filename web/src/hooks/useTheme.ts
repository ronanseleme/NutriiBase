import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'nutribase.theme'

function readStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// Preferência de tema é só do dispositivo (localStorage), não da conta —
// evita precisar de uma coluna nova no Supabase só pra isso. Claro é o
// padrão (nenhum atributo); o <html> já recebe o data-theme="dark" certo
// antes do primeiro paint via script inline no index.html quando o usuário
// tinha escolhido escuro antes — este hook só mantém o estado em sincronia
// pra alternar em tempo real e persistir a escolha.
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
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
