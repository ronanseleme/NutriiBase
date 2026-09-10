import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useDayLog } from './hooks/useDayLog'
import { useMetasExtras } from './hooks/useMetasExtras'
import { useRecentLogs } from './hooks/useRecentLogs'
import { AuthScreen } from './components/AuthScreen'
import { ProfileForm } from './components/ProfileForm'
import { ProfileScreen } from './components/ProfileScreen'
import { Dashboard } from './components/Dashboard'
import { Logo } from './components/Logo'
import { DateNav } from './components/DateNav'
import { TabBar, type TabKey } from './components/TabBar'
import { FoodTab } from './components/food/FoodTab'
import { WorkoutTab } from './components/workout/WorkoutTab'
import { MetasTab } from './components/metas/MetasTab'
import { AssistantTab } from './components/assistant/AssistantTab'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminTab } from './components/admin/AdminTab'
import { RoleBadge } from './components/RoleBadge'
import { ViewModeToggle, type ViewMode } from './components/ViewModeToggle'
import { todayISO } from './lib/dateUtils'
import { getInitials } from './lib/initials'
import type { DateRange } from './types'

function App() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { profile, loading: profileLoading, isNew, saveProfile } = useProfile(user?.id ?? null)
  const [dateIso, setDateIso] = useState(todayISO())
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)

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
      <div className="sticky top-0 z-10 bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Logo size={28} />
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('profile')}
              title="Ver perfil"
              className="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--bg)]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-[0.62rem] font-bold text-white">
                {getInitials(profile.name)}
              </span>
              <span className="min-w-0 truncate text-xs font-semibold text-[var(--text-soft)]" title={user.email ?? undefined}>
                {profile.name || user.email}
              </span>
              <RoleBadge role={profile.role} />
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="nb-btn nb-btn-secondary shrink-0 px-3 py-1.5 text-xs"
            >
              Sair
            </button>
          </div>
        </div>
        <TabBar active={tab} onChange={setTab} showAdmin={profile.role === 'admin'} />
        <div className="h-[3px] bg-[image:var(--brand-gradient)] opacity-80" />
      </div>

      <div className="mx-auto max-w-md p-4">
        {isNew && (
          <div className="nb-card mb-4 border-l-4 border-[var(--orange)]">
            <p className="mb-2.5 text-[0.86rem]">
              <strong>Bem-vindo(a)!</strong> Complete seu perfil para calcularmos sua meta calórica e de macros.
            </p>
            <button type="button" onClick={() => setShowProfileForm(true)} className="nb-btn nb-btn-primary px-4 py-2 text-sm">
              Editar perfil
            </button>
          </div>
        )}

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
          <ProfileScreen profile={profile} onEditProfile={() => setShowProfileForm(true)} />
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
