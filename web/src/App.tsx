import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useDayLog } from './hooks/useDayLog'
import { AuthScreen } from './components/AuthScreen'
import { ProfileForm } from './components/ProfileForm'
import { Dashboard } from './components/Dashboard'
import { todayISO } from './lib/dateUtils'

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, loading: profileLoading, isNew, saveProfile } = useProfile(user?.id ?? null)
  const [dateIso] = useState(todayISO())
  const { log, saveWeight, saveBodyFat } = useDayLog(user?.id ?? null, dateIso)
  const [showProfileForm, setShowProfileForm] = useState(false)

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-soft)]">Carregando…</div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (profileLoading || !profile) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-soft)]">
        Carregando seus dados…
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[var(--bg)] pb-8">
      <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-[Space_Grotesk] font-bold">
            <span className="inline-block h-[9px] w-[9px] rotate-45 rounded-sm bg-[var(--orange)]" />
            NutriiBase
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md p-4">
        {isNew && (
          <div className="mb-4 rounded-[18px] border-l-4 border-[var(--orange)] bg-[var(--surface)] p-4">
            <p className="mb-2.5 text-[0.86rem]">
              <strong>Bem-vindo(a)!</strong> Complete seu perfil para calcularmos sua meta calórica e de macros.
            </p>
            <button
              type="button"
              onClick={() => setShowProfileForm(true)}
              className="rounded-[8px] bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white"
            >
              Editar perfil
            </button>
          </div>
        )}

        <Dashboard
          profile={profile}
          dateIso={dateIso}
          log={log}
          onEditProfile={() => setShowProfileForm(true)}
          onSaveWeight={saveWeight}
          onSaveBodyFat={saveBodyFat}
        />
      </div>

      {showProfileForm && (
        <ProfileForm profile={profile} onSave={saveProfile} onClose={() => setShowProfileForm(false)} />
      )}
    </div>
  )
}

export default App
