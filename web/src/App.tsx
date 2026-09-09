import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useDayLog } from './hooks/useDayLog'
import { AuthScreen } from './components/AuthScreen'
import { ProfileForm } from './components/ProfileForm'
import { Dashboard } from './components/Dashboard'
import { Logo } from './components/Logo'
import { DateNav } from './components/DateNav'
import { TabBar, type TabKey } from './components/TabBar'
import { FoodTab } from './components/food/FoodTab'
import { todayISO } from './lib/dateUtils'

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, loading: profileLoading, isNew, saveProfile } = useProfile(user?.id ?? null)
  const [dateIso, setDateIso] = useState(todayISO())
  const [tab, setTab] = useState<TabKey>('dashboard')
  const {
    log,
    saveWeight,
    saveBodyFat,
    draft,
    addToDraft,
    removeDraftItem,
    saveMeal,
    deleteFoodItem,
    updateFoodItem,
  } = useDayLog(user?.id ?? null, dateIso)
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
      <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Logo size={28} />
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--bg)]"
          >
            Sair
          </button>
        </div>
        <TabBar active={tab} onChange={setTab} />
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

        {(tab === 'dashboard' || tab === 'food') && <DateNav dateIso={dateIso} onChange={setDateIso} />}

        {tab === 'dashboard' && (
          <Dashboard
            profile={profile}
            log={log}
            onEditProfile={() => setShowProfileForm(true)}
            onSaveWeight={saveWeight}
            onSaveBodyFat={saveBodyFat}
          />
        )}

        {tab === 'food' && (
          <FoodTab
            log={log}
            draft={draft}
            targets={profile.targets}
            onAddToDraft={addToDraft}
            onAddManyToDraft={(mealKey, items) => items.forEach((it) => addToDraft(mealKey, it))}
            onRemoveDraft={removeDraftItem}
            onSaveMeal={saveMeal}
            onDeleteSaved={deleteFoodItem}
            onUpdateSaved={updateFoodItem}
          />
        )}

        {tab !== 'dashboard' && tab !== 'food' && (
          <div className="rounded-[18px] bg-[var(--surface)] p-6 text-center text-[0.9rem] text-[var(--text-soft)] shadow-[0_1px_2px_rgba(43,43,51,.06),0_10px_26px_-16px_rgba(43,43,51,.28)]">
            Essa aba ainda está em construção — chega numa próxima fase.
          </div>
        )}
      </div>

      {showProfileForm && (
        <ProfileForm profile={profile} onSave={saveProfile} onClose={() => setShowProfileForm(false)} />
      )}
    </div>
  )
}

export default App
