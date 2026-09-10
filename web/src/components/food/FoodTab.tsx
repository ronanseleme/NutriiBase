import { useState } from 'react'
import { MEALS } from '../../lib/constants'
import { dayFoodTotals, mealTotals } from '../../lib/calculations'
import { MealSummary } from './MealSummary'
import { MealDetail } from './MealDetail'
import type { AiAccess, DayLog, FoodItem, MealKey, Targets } from '../../types'

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  log: DayLog
  draft: Record<MealKey, FoodItem[]>
  targets: Targets
  access: AiAccess
  onAddToDraft: (mealKey: MealKey, item: FoodItem) => void
  onAddManyToDraft: (mealKey: MealKey, items: FoodItem[]) => void
  onRemoveDraft: (mealKey: MealKey, itemId: string) => void
  onSaveMeal: (mealKey: MealKey) => Promise<{ error: Error | null }>
  onDeleteSaved: (mealKey: MealKey, itemId: string) => Promise<{ error: Error | null }>
  onUpdateSaved: (mealKey: MealKey, item: FoodItem) => Promise<{ error: Error | null }>
}

export function FoodTab({
  log,
  draft,
  targets,
  access,
  onAddToDraft,
  onAddManyToDraft,
  onRemoveDraft,
  onSaveMeal,
  onDeleteSaved,
  onUpdateSaved,
}: Props) {
  const [active, setActive] = useState<MealKey | 'geral'>('geral')
  const dayTotals = dayFoodTotals(log.meals)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <MealChip label={`Geral ${fmtNum(dayTotals.kcal)}`} active={active === 'geral'} onClick={() => setActive('geral')} />
        {MEALS.map((m) => {
          const t = mealTotals(log.meals[m.key])
          return (
            <MealChip
              key={m.key}
              label={`${m.label} ${fmtNum(t.kcal)}`}
              active={active === m.key}
              onClick={() => setActive(m.key)}
            />
          )
        })}
      </div>

      {active === 'geral' ? (
        <MealSummary meals={log.meals} targets={targets} />
      ) : (
        <MealDetail
          mealLabel={MEALS.find((m) => m.key === active)!.label}
          saved={log.meals[active]}
          draft={draft[active]}
          targetKcal={targets.kcal}
          access={access}
          onAddToDraft={(item) => onAddToDraft(active, item)}
          onAddManyToDraft={(items) => onAddManyToDraft(active, items)}
          onRemoveDraft={(itemId) => onRemoveDraft(active, itemId)}
          onSaveMeal={() => onSaveMeal(active)}
          onDeleteSaved={(itemId) => onDeleteSaved(active, itemId)}
          onUpdateSaved={(item) => onUpdateSaved(active, item)}
        />
      )}
    </div>
  )
}

function MealChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-[0.82rem] font-semibold whitespace-nowrap transition-all ${
        active
          ? 'border-transparent bg-[image:var(--blue-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.5)]'
          : 'border-[var(--line-strong)] bg-[var(--surface)]'
      }`}
    >
      {label}
    </button>
  )
}
