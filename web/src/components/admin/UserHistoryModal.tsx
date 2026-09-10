import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MEAL_KEY_FROM_DB } from '../../lib/mappers'
import { MEALS } from '../../lib/constants'

interface MealRow {
  id: string
  data: string
  tipo_refeicao: string
  nome_alimento: string
  kcal: number
}
interface WorkoutRow {
  id: string
  data: string
  tipo_atividade: string
  kcal_estimado: number
  duracao_min: number | null
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso + 'T00:00:00'))
}
function mealLabel(tipo: string): string {
  const key = MEAL_KEY_FROM_DB[tipo]
  return MEALS.find((m) => m.key === key)?.label || tipo
}

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

export function UserHistoryModal({ userId, userName, onClose }: Props) {
  const [meals, setMeals] = useState<MealRow[] | null>(null)
  const [workouts, setWorkouts] = useState<WorkoutRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [mealsRes, workoutsRes] = await Promise.all([
        supabase
          .from('refeicoes')
          .select('id, data, tipo_refeicao, nome_alimento, kcal')
          .eq('user_id', userId)
          .order('data', { ascending: false })
          .limit(30),
        supabase
          .from('treinos')
          .select('id, data, tipo_atividade, kcal_estimado, duracao_min')
          .eq('user_id', userId)
          .order('data', { ascending: false })
          .limit(30),
      ])
      if (cancelled) return
      if (mealsRes.error || workoutsRes.error) {
        setError(mealsRes.error?.message || workoutsRes.error?.message || 'Erro ao carregar histórico.')
        return
      }
      setMeals(mealsRes.data as MealRow[])
      setWorkouts(workoutsRes.data as WorkoutRow[])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal max-h-[85vh] w-full max-w-md overflow-auto">
        <h2 className="mb-1 text-[1.1rem] font-bold">Histórico — {userName}</h2>
        <p className="mb-4 text-[0.8rem] text-[var(--text-soft)]">Somente leitura · últimos 30 registros de cada</p>

        {error && <div className="text-[0.84rem] text-[var(--coral)]">{error}</div>}
        {!error && (meals === null || workouts === null) && (
          <div className="text-[0.84rem] text-[var(--text-soft)]">Carregando…</div>
        )}

        {meals && (
          <div className="mb-4">
            <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              Refeições
            </div>
            {meals.length === 0 && <p className="text-[0.82rem] text-[var(--text-soft)]">Nenhum registro.</p>}
            {meals.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 text-[0.82rem]">
                <span className="shrink-0 text-[var(--text-soft)]">{fmtDate(m.data)}</span>
                <span className="min-w-0 flex-1 truncate">{m.nome_alimento}</span>
                <span className="shrink-0 text-[0.72rem] text-[var(--text-soft)]">{mealLabel(m.tipo_refeicao)}</span>
                <span className="shrink-0 font-semibold">{Math.round(m.kcal)} kcal</span>
              </div>
            ))}
          </div>
        )}

        {workouts && (
          <div>
            <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              Treinos
            </div>
            {workouts.length === 0 && <p className="text-[0.82rem] text-[var(--text-soft)]">Nenhum registro.</p>}
            {workouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 text-[0.82rem]">
                <span className="shrink-0 text-[var(--text-soft)]">{fmtDate(w.data)}</span>
                <span className="min-w-0 flex-1 truncate capitalize">{w.tipo_atividade}</span>
                <span className="shrink-0 text-[0.72rem] text-[var(--text-soft)]">{w.duracao_min ? `${w.duracao_min} min` : ''}</span>
                <span className="shrink-0 font-semibold">{Math.round(w.kcal_estimado)} kcal</span>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={onClose} className="nb-btn nb-btn-secondary mt-4 w-full py-2.5">
          Fechar
        </button>
      </div>
    </div>
  )
}
