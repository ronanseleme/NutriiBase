import { useSyncExternalStore } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'nutribase.theme'

function readStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyThemeToDocument(theme: ThemeMode) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

// Estado num módulo (não num useState local) de propósito: Logo aparece
// tanto na AuthScreen (fora da árvore do App) quanto no topbar dentro do
// App, e o seletor de tema fica dentro do ProfileForm — com useState local
// em cada chamada de useTheme(), cada componente teria sua própria cópia
// desincronizada do tema, e só o CSS (que é global) mudaria na hora; o
// <img src> do Logo, por exemplo, ficaria preso no tema antigo até
// remontar. Um único estado compartilhado (useSyncExternalStore) garante
// que toda chamada de useTheme() em qualquer lugar da árvore reflete e
// reage à mesma escolha.
let currentTheme: ThemeMode = readStoredTheme()
applyThemeToDocument(currentTheme)
const listeners = new Set<() => void>()

function setGlobalTheme(next: ThemeMode) {
  if (next === currentTheme) return
  currentTheme = next
  applyThemeToDocument(next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage indisponível (modo privado etc.) — só não persiste
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentTheme
}

// Preferência de tema é só do dispositivo (localStorage), não da conta —
// evita precisar de uma coluna nova no Supabase só pra isso. Claro é o
// padrão (nenhum atributo); o <html> já recebe o data-theme="dark" certo
// antes do primeiro paint via script inline no index.html quando o usuário
// tinha escolhido escuro antes.
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)
  return { theme, setTheme: setGlobalTheme }
}
