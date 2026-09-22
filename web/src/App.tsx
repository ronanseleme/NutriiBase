import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useDayLog } from './hooks/useDayLog'
import { useMetasExtras } from './hooks/useMetasExtras'
import { useRecentLogs } from './hooks/useRecentLogs'
import { AuthScreen } from './components/AuthScreen'
import { Avatar } from './components/Avatar'
import { CheckoutSuccessScreen } from './components/CheckoutSuccessScreen'
import { ProfileForm } from './components/ProfileForm'
import { ProfileScreen } from './components/ProfileScreen'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { Dashboard } from './components/Dashboard'
import { Logo } from './components/Logo'
import { DateNav } from './components/DateNav'
import { TabBar, AdminIcon, type TabKey } from './components/TabBar'
import { FoodTab } from './components/food/FoodTab'
import { WorkoutTab } from './components/workout/WorkoutTab'
import { MetasTab } from './components/metas/MetasTab'
import { AssistantTab } from './components/assistant/AssistantTab'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminTab } from './components/admin/AdminTab'
import { RoleBadge } from './components/RoleBadge'
import { ViewModeToggle, type ViewMode } from './components/ViewModeToggle'
import { parseISODate, todayISO } from './lib/dateUtils'
import { registerGoToProfile, registerGoToAddMeal } from './lib/tabNav'
import type { DateRange } from './types'

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, loading: profileLoading, isNew, saveProfile, refetch: refetchProfile } = useProfile(user?.id ?? null)
  const [dateIso, setDateIso] = useState(todayISO())
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)
  const [addMealSignal, setAddMealSignal] = useState(0)
  // Sinalizado pelo successUrl do Stripe Checkout (?checkout=success) — dá
  // pra vir direto na 1ª renderização (sem esperar profile/log carregarem).
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(
    () => new URLSearchParams(window.location.search).get('checkout') === 'success',
  )

  useEffect(() => {
    if (!showCheckoutSuccess) return
    // Limpa o parâmetro da URL — evita reabrir essa tela se a pessoa der F5.
    const url = new URL(window.location.href)
    url.searchParams.delete('checkout')
    window.history.replaceState({}, '', url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    registerGoToProfile(() => setTab('profile'))
    registerGoToAddMeal(() => {
      setViewMode('daily')
      setTab('food')
      setAddMealSignal((n) => n + 1)
    })
  }, [])

  useEffect(() => {
    // Uma vez logado, não faz mais sentido o AuthScreen continuar abrindo
    // em modo "Criar conta" pra esse dispositivo (ex: se a pessoa sair e
    // entrar de novo depois).
    if (user) localStorage.removeItem('nb_signup')
  }, [user])

  function handleDateChange(iso: string) {
    setCustomRange(null)
    setDateIso(iso)
  }
  function handleSelectRange(start: string, end: string) {
    setCustomRange({ start, end })
    setDateIso(end)
    setViewMode('monthly')
  }
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
    saveWorkout,
    deleteWorkout,
  } = useDayLog(user?.id ?? null, dateIso)
  const { startWeight, weekWorkoutCount } = useMetasExtras(user?.id ?? null, profile?.weightKg ?? 70)
  const { recentMap } = useRecentLogs(user?.id ?? null)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [onboardingInited, setOnboardingInited] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!profileLoading && profile && !onboardingInited) {
      setShowOnboarding(isNew)
      setOnboardingInited(true)
    }
  }, [profileLoading, profile, isNew, onboardingInited])

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-soft)]">Carregando…</div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (showCheckoutSuccess) {
    return <CheckoutSuccessScreen onContinue={() => setShowCheckoutSuccess(false)} />
  }

  if (profileLoading || !profile) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-soft)]">
        Carregando seus dados…
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        profile={profile}
        onSaveProfile={saveProfile}
        onFinish={() => setShowOnboarding(false)}
        onProfileRefresh={refetchProfile}
      />
    )
  }

  return (
    <div className="min-h-svh bg-[var(--bg)] pb-8">
      <div className="sticky top-0 z-10 bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Logo size={28} />
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('profile')}
              title="Ver perfil"
              aria-label={`Ver perfil de ${profile.name || user.email}`}
              className="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--bg)]"
            >
              <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={24} />
              <RoleBadge role={profile.role} />
            </button>
            {profile.role === 'admin' && (
              <button
                type="button"
                onClick={() => setTab('admin')}
                title="Administração"
                aria-label="Abrir administração"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                  tab === 'admin'
                    ? 'bg-[image:var(--brand-gradient)] text-white'
                    : 'text-[var(--text-soft)] hover:bg-[var(--bg)]'
                }`}
              >
                <AdminIcon />
              </button>
            )}
            <button
              type="button"
              onClick={() => signOut()}
              className="nb-btn nb-btn-secondary shrink-0 px-3 py-1.5 text-xs hover:border-transparent hover:bg-[var(--coral)] hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>
        <TabBar active={tab} onChange={setTab} />
        <div className="h-[3px] bg-[image:var(--brand-gradient)] opacity-80" />
      </div>

      <div className="mx-auto max-w-md p-4">
        {(tab === 'dashboard' || tab === 'food' || tab === 'workout') && (
          <>
            <DateNav
              dateIso={dateIso}
              onChange={handleDateChange}
              customRange={customRange}
              onSelectRange={handleSelectRange}
              onClearRange={() => setCustomRange(null)}
            />
            <div className="mb-4 -mt-2">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            {profile.role === 'free' &&
              (() => {
                const earliestIso = customRange?.start ?? dateIso
                const daysAgo = Math.round(
                  (parseISODate(todayISO()).getTime() - parseISODate(earliestIso).getTime()) / 86400000,
                )
                if (daysAgo <= 7) return null
                return (
                  <p className="mb-4 -mt-2 text-[0.78rem] text-[var(--text-soft)]">
                    📅 Free mostra só os últimos 7 dias de histórico — assine o Pro pra ver datas mais antigas.
                  </p>
                )
              })()}
          </>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            profile={profile}
            log={log}
            userId={user.id}
            dateIso={dateIso}
            viewMode={viewMode}
            customRange={customRange}
            onSaveWeight={saveWeight}
            onSaveBodyFat={saveBodyFat}
          />
        )}

        {tab === 'profile' && (
          <ProfileScreen profile={profile} onEditProfile={() => setShowProfileForm(true)} onProfileRefresh={refetchProfile} />
        )}

        {tab === 'food' && (
          <FoodTab
            log={log}
            draft={draft}
            targets={profile.targets}
            access={profile}
            userId={user.id}
            dateIso={dateIso}
            viewMode={viewMode}
            customRange={customRange}
            openPickerSignal={addMealSignal}
            onAddToDraft={addToDraft}
            onAddManyToDraft={(mealKey, items) => items.forEach((it) => addToDraft(mealKey, it))}
            onRemoveDraft={removeDraftItem}
            onSaveMeal={saveMeal}
            onDeleteSaved={deleteFoodItem}
            onUpdateSaved={updateFoodItem}
          />
        )}

        {tab === 'workout' && (
          <WorkoutTab
            log={log}
            weightKg={profile.weightKg}
            userId={user.id}
            dateIso={dateIso}
            viewMode={viewMode}
            customRange={customRange}
            onSaveWorkout={saveWorkout}
            onDeleteWorkout={deleteWorkout}
          />
        )}

        {tab === 'goals' && (
          <MetasTab
            profile={profile}
            startWeight={startWeight}
            weekWorkoutCount={weekWorkoutCount}
            userId={user.id}
            onSaveProfile={saveProfile}
          />
        )}

        {tab === 'assistant' && <AssistantTab userId={user.id} profile={profile} recentMap={recentMap} />}

        {tab === 'admin' && (
          <ProtectedRoute
            role={profile.role}
            allowedRoles={['admin']}
            fallback={<div className="nb-card text-[0.86rem] text-[var(--text-soft)]">Acesso restrito.</div>}
          >
            <AdminTab />
          </ProtectedRoute>
        )}
      </div>

      {showProfileForm && (
        <ProfileForm profile={profile} onSave={saveProfile} onClose={() => setShowProfileForm(false)} />
      )}
    </div>
  )
}

export default App
