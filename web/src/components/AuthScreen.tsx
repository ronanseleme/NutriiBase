import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { mapAuthError } from '../lib/authErrors'
import { Logo } from './Logo'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignin = mode === 'signin'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { data, error: authError } = isSignin
      ? await signIn(email, password)
      : await signUp(email, password)
    setLoading(false)
    if (authError) {
      setError(mapAuthError(authError.message))
      return
    }
    if (!isSignin && data.user && !data.session) {
      setInfo('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
    }
    // Se já existe sessão, o useAuth() do App cuida do resto.
  }

  function toggleMode() {
    setMode(isSignin ? 'signup' : 'signin')
    setError(null)
    setInfo(null)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[var(--bg)] p-4">
      <div
        className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--orange)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--blue)' }}
      />
      <div
        className="pointer-events-none absolute right-1/3 top-1/4 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--green)' }}
      />
      <div className="nb-modal relative w-full max-w-sm p-7">
        <div className="mb-6">
          <Logo size={40} />
        </div>
        <h1 className="mb-1.5 text-[1.3rem] font-bold text-[var(--text)]">
          {isSignin ? 'Entrar' : 'Criar conta'}
        </h1>
        <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">
          {isSignin
            ? 'Acesse sua conta para registrar sua alimentação e treinos.'
            : 'Crie sua conta para começar a usar o NutriiBase.'}
        </p>

        {error && (
          <div className="mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--coral)_35%,transparent)] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] px-3 py-2.5 text-[0.82rem] text-[var(--coral)]">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--teal)_35%,transparent)] bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] px-3 py-2.5 text-[0.82rem] text-[var(--teal)]">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="nb-input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isSignin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="nb-input"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="nb-btn nb-btn-primary mt-1 py-2.5"
          >
            {loading ? (isSignin ? 'Entrando…' : 'Criando conta…') : isSignin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-4 text-center text-[0.85rem] text-[var(--text-soft)]">
          {isSignin ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-bold text-[var(--blue)]"
          >
            {isSignin ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
