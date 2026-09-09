import { useAuth } from './hooks/useAuth'
import { AuthScreen } from './components/AuthScreen'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-soft)]">Carregando…</div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="min-h-svh bg-[var(--bg)] p-4">
      <div className="mx-auto max-w-md rounded-[18px] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
        <h1 className="mb-2 text-[1.2rem] font-bold">Logado como {user.email}</h1>
        <p className="mb-4 text-[0.85rem] text-[var(--text-soft)]">
          Fase 1 (auth) funcionando. As próximas telas (Painel, Alimentação, Treino, Metas) entram nas
          próximas fases.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-bold"
        >
          Sair
        </button>
      </div>
    </div>
  )
}

export default App
