import type { FoodItem } from '../../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  item: FoodItem
  targetKcal: number
  isDraft?: boolean
  onEdit?: () => void
  onRemove: () => void
}

export function ItemRow({ item, targetKcal, isDraft, onEdit, onRemove }: Props) {
  const pctGoal = targetKcal > 0 ? Math.round((item.kcal / targetKcal) * 100) : 0
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0 ${
        isDraft ? 'opacity-90' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{item.name}</div>
        {item.grams != null && <div className="text-[0.78rem] text-[var(--text-soft)]">{fmtNum(item.grams)} g</div>}
        <div className="mt-0.5 flex gap-2 text-[0.78rem]">
          <span style={{ color: 'var(--protein)' }}>
            P <b>{fmtNum(item.protein)}</b>g
          </span>
          ·{' '}
          <span style={{ color: 'var(--carb)' }}>
            C <b>{fmtNum(item.carbs)}</b>g
          </span>
          ·{' '}
          <span style={{ color: 'var(--fat)' }}>
            G <b>{fmtNum(item.fat)}</b>g
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-bold">{fmtNum(item.kcal)} kcal</div>
        <div className="text-[0.72rem] text-[var(--text-soft)]">{pctGoal}% da meta</div>
      </div>
      <div className="flex shrink-0 gap-1">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${item.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--bg)]"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${item.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--bg)] hover:text-[var(--coral)]"
        >
          ×
        </button>
      </div>
    </div>
  )
}
