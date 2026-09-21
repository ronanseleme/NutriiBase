import { useEffect, useState } from 'react'
import { MEALS } from '../../lib/constants'
import { dayFoodTotals, mealTotals } from '../../lib/calculations'
import { computeRangeMealTotals, computeRangeTotals } from '../../lib/insights'
import { formatShortDate, monthLabel, pad, parseISODate } from '../../lib/dateUtils'
import { useRangeLogs } from '../../hooks/useRangeLogs'
import { MealSummary } from './MealSummary'
import { MealDetail } from './MealDetail'
import { AddMealPicker } from './AddMealPicker'
import { AddFoodModal } from './AddFoodModal'
import { MealAiModal } from './MealAiModal'
import { GeralIcon, MEAL_ICONS } from './mealIcons'
import type { ViewMode } from '../ViewModeToggle'
import type { AiAccess, DateRange, DayLog, FoodItem, MealKey, Targets } from '../../types'

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  log: DayLog
  draft: Record<MealKey, FoodItem[]>
  targets: Targets
  access: AiAccess
  userId: string | null
  dateIso: string
  viewMode: ViewMode
  customRange: DateRange | null
  openPickerSignal?: number
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
  userId,
  dateIso,
  viewMode,
  customRange,
  openPickerSignal,
  onAddToDraft,
  onAddManyToDraft,
  onRemoveDraft,
  onSaveMeal,
  onDeleteSaved,
  onUpdateSaved,
}: Props) {
  const [active, setActive] = useState<MealKey | 'geral'>('geral')
  const [pickingMeal, setPickingMeal] = useState(false)

  // Sinal vindo de fora (ex: botão "Adicionar refeição" no Painel) pra abrir
  // a tela de escolha de refeição direto, sem precisar clicar de novo aqui.
  useEffect(() => {
    if (openPickerSignal) setPickingMeal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPickerSignal])
  const [addFlowMeal, setAddFlowMeal] = useState<MealKey | null>(null)
  const [aiFlowMeal, setAiFlowMeal] = useState<MealKey | null>(null)
  const dayTotals = dayFoodTotals(log.meals)
  const kcalByMeal = Object.fromEntries(MEALS.map((m) => [m.key, mealTotals(log.meals[m.key]).kcal])) as Record<MealKey, number>

  const selected = parseISODate(dateIso)
  const selY = selected.getFullYear()
  const selM = selected.getMonth() + 1
  const rangeStart = customRange?.start ?? `${selY}-${pad(selM)}-01`
  const rangeEnd = customRange?.end ?? dateIso
  const { rangeMap, refeicoes: rangeRefeicoes, reload: reloadRange } = useRangeLogs(userId, rangeStart, rangeEnd)
  useEffect(() => {
    reloadRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log])

  if (viewMode === 'monthly') {
    const mtd = computeRangeTotals(rangeStart, rangeEnd, rangeMap)
    const mealTotalsRange = computeRangeMealTotals(rangeRefeicoes)
    const periodLabel = customRange
      ? `${formatShortDate(rangeStart)} até ${formatShortDate(rangeEnd)}`
      : `1 a ${selected.getDate()} de ${monthLabel(selY, selM)}`
    return (
      <div className="nb-card">
        <div className="nb-card-title">Resumo do mês</div>
        <p className="mb-3 text-[0.8rem] text-[var(--text-soft)]">Acumulado de {periodLabel}</p>
        <div className="mb-1.5 grid grid-cols-[1fr_repeat(5,44px)] gap-1 border-b border-[var(--line)] pb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
          <span />
          <span className="text-right">Gramas</span>
          <span className="text-right">Kcal</span>
          <span className="text-right" style={{ color: 'var(--protein)' }}>
            Prot
          </span>
          <span className="text-right" style={{ color: 'var(--carb)' }}>
            Carb
          </span>
          <span className="text-right" style={{ color: 'var(--fat)' }}>
            Gord
          </span>
        </div>
        {MEALS.map((m) => {
          const t = mealTotalsRange[m.key] || { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
          return (
            <div
              key={m.key}
              className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 border-b border-[var(--line)] py-2 text-[0.82rem] last:border-b-0"
            >
              <span>{m.label}</span>
              <span className="text-right font-semibold text-[var(--text-soft)]">{fmtNum(t.grams)}</span>
              <span className="text-right font-semibold">{fmtNum(t.kcal)}</span>
              <span className="text-right font-semibold" style={{ color: 'var(--protein)' }}>
                {fmtNum(t.protein)}
              </span>
              <span className="text-right font-semibold" style={{ color: 'var(--carb)' }}>
                {fmtNum(t.carbs)}
              </span>
              <span className="text-right font-semibold" style={{ color: 'var(--fat)' }}>
                {fmtNum(t.fat)}
              </span>
            </div>
          )
        })}
        <div className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 border-t-2 border-[var(--line-strong)] pt-2.5 text-[0.85rem] font-extrabold">
          <span>Total</span>
          <span className="text-right text-[var(--text-soft)]">{fmtNum(mtd.grams)}</span>
          <span className="text-right">{fmtNum(mtd.kcal)}</span>
          <span className="text-right" style={{ color: 'var(--protein)' }}>
            {fmtNum(mtd.protein)}
          </span>
          <span className="text-right" style={{ color: 'var(--carb)' }}>
            {fmtNum(mtd.carbs)}
          </span>
          <span className="text-right" style={{ color: 'var(--fat)' }}>
            {fmtNum(mtd.fat)}
          </span>
        </div>
        <p className="mt-4 text-[0.8rem] text-[var(--text-soft)]">
          Mude para <b>Diária</b> para ver, adicionar ou editar refeições de um dia específico.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setPickingMeal(true)}
        className="nb-btn nb-btn-primary w-full py-2.5"
      >
        + Adicionar refeição
      </button>

      <div className="grid grid-cols-4 gap-1.5">
        <MealTile label="Geral" sub={fmtNum(dayTotals.kcal)} Icon={GeralIcon} active={active === 'geral'} onClick={() => setActive('geral')} />
        {MEALS.map((m) => {
          const t = mealTotals(log.meals[m.key])
          return (
            <MealTile
              key={m.key}
              label={m.label}
              sub={fmtNum(t.kcal)}
              Icon={MEAL_ICONS[m.key]}
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
          userId={userId}
          onAddToDraft={(item) => onAddToDraft(active, item)}
          onAddManyToDraft={(items) => onAddManyToDraft(active, items)}
          onRemoveDraft={(itemId) => onRemoveDraft(active, itemId)}
          onSaveMeal={() => onSaveMeal(active)}
          onDeleteSaved={(itemId) => onDeleteSaved(active, itemId)}
          onUpdateSaved={(item) => onUpdateSaved(active, item)}
        />
      )}

      {pickingMeal && (
        <AddMealPicker
          kcalByMeal={kcalByMeal}
          onPick={(mealKey) => {
            setPickingMeal(false)
            setAddFlowMeal(mealKey)
          }}
          onClose={() => setPickingMeal(false)}
        />
      )}
      {addFlowMeal && (
        <AddFoodModal
          mealLabel={MEALS.find((m) => m.key === addFlowMeal)!.label}
          editItem={null}
          draftCount={draft[addFlowMeal].length}
          access={access}
          onAdd={(item) => onAddToDraft(addFlowMeal, item)}
          onUpdate={async () => ({ error: null })}
          onDescribeWithAI={() => {
            setAiFlowMeal(addFlowMeal)
            setAddFlowMeal(null)
          }}
          onClose={() => {
            setActive(addFlowMeal)
            setAddFlowMeal(null)
          }}
        />
      )}
      {aiFlowMeal && (
        <MealAiModal
          mealLabel={MEALS.find((m) => m.key === aiFlowMeal)!.label}
          access={access}
          onAddMany={(items) => onAddManyToDraft(aiFlowMeal, items)}
          onClose={() => {
            setActive(aiFlowMeal)
            setAiFlowMeal(null)
          }}
        />
      )}
    </div>
  )
}

function MealTile({
  label,
  sub,
  Icon,
  active,
  onClick,
}: {
  label: string
  sub: string
  Icon: () => React.ReactElement
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.62rem] font-semibold transition-all ${
        active
          ? 'bg-[image:var(--brand-gradient)] text-white shadow-[0_6px_14px_-6px_rgba(47,111,237,.55)]'
          : 'bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--bg)]'
      }`}
    >
      <Icon />
      <span className="text-center leading-tight">{label}</span>
      <span className={`text-[0.6rem] ${active ? 'text-white/80' : 'text-[var(--text-soft)]'}`}>{sub}</span>
    </button>
  )
}
