import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { mapAuthError } from '../lib/authErrors'
import { Logo } from './Logo'

type Mode = 'signin' | 'signup'

// Ícone oficial do Google ("G" multicolor).
function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.581C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isSignin = mode === 'signin'

  // Se o Google/Supabase redirecionou de volta com erro (usuário cancelou o
  // consentimento, etc.), o erro vem como parâmetro na URL — nunca como uma
  // rejeição de promise, já que o redirect já aconteceu antes.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search)
    // Prioriza o código de erro (estável, ex: "access_denied") sobre a descrição
    // (texto livre do provedor) para o mapeamento de mensagem amigável funcionar.
    const oauthError = params.get('error') || params.get('error_description')
    if (oauthError) {
      setError(mapAuthError(oauthError))
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

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

  async function handleGoogleSignIn() {
    setError(null)
    setInfo(null)
    setGoogleLoading(true)
    const { error: authError } = await signInWithGoogle()
    // Em caso de sucesso o navegador já foi redirecionado para o Google —
    // só chegamos aqui de volta se algo deu errado antes do redirect.
    if (authError) {
      setGoogleLoading(false)
      setError(mapAuthError(authError.message))
    }
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

        <div className="my-4 flex items-center gap-3 text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--text-soft)]">
          <div className="h-px flex-1 bg-[var(--line)]" />
          ou
          <div className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="nb-btn nb-btn-secondary flex w-full items-center justify-center gap-2.5 py-2.5"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecionando…' : 'Continuar com Google'}
        </button>

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
