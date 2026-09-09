import { useState } from 'react'
import { ItemRow } from './ItemRow'
import { AddFoodModal } from './AddFoodModal'
import { MealAiModal } from './MealAiModal'
import type { FoodItem } from '../../types'

interface Props {
  mealLabel: string
  saved: FoodItem[]
  draft: FoodItem[]
  targetKcal: number
  onAddToDraft: (item: FoodItem) => void
  onAddManyToDraft: (items: FoodItem[]) => void
  onRemoveDraft: (itemId: string) => void
  onSaveMeal: () => Promise<{ error: Error | null }>
  onDeleteSaved: (itemId: string) => Promise<{ error: Error | null }>
  onUpdateSaved: (item: FoodItem) => Promise<{ error: Error | null }>
}

export function MealDetail({
  mealLabel,
  saved,
  draft,
  targetKcal,
  onAddToDraft,
  onAddManyToDraft,
  onRemoveDraft,
  onSaveMeal,
  onDeleteSaved,
  onUpdateSaved,
}: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [editItem, setEditItem] = useState<FoodItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSaveMeal()
    setSaving(false)
    if (saveError) setError('Não foi possível salvar, tente novamente.')
  }

  return (
    <div className="nb-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="nb-card-title mb-0">{mealLabel}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAi(true)}
            className="rounded-full px-3 py-1.5 text-[0.78rem] font-bold text-[var(--blue)]"
            style={{ background: 'color-mix(in srgb, var(--blue) 12%, var(--surface))' }}
          >
            ✨ Descrever com IA
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-full border border-[var(--line-strong)] px-3 py-1.5 text-[0.78rem] font-bold"
          >
            + Adicionar
          </button>
        </div>
      </div>

      {saved.length === 0 && draft.length === 0 && (
        <div className="py-2 text-[0.85rem] italic text-[var(--text-soft)]">Nenhum alimento salvo ainda nesta refeição.</div>
      )}

      {saved.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          targetKcal={targetKcal}
          onEdit={() => setEditItem(it)}
          onRemove={() => onDeleteSaved(it.id)}
        />
      ))}

      {draft.length > 0 && (
        <>
          <div className="mb-1 mt-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-[var(--orange)]">
            Rascunho — ainda não salvo
          </div>
          {draft.map((it) => (
            <ItemRow key={it.id} item={it} targetKcal={targetKcal} isDraft onRemove={() => onRemoveDraft(it.id)} />
          ))}
        </>
      )}

      {error && <div className="mt-3 text-[0.8rem] text-[var(--coral)]">{error}</div>}

      <button
        type="button"
        onClick={handleSave}
        disabled={!draft.length || saving}
        className="nb-btn nb-btn-primary mt-3 w-full py-2.5"
      >
        {saving ? 'Salvando…' : `Salvar refeição${draft.length ? ` (${draft.length})` : ''}`}
      </button>

      {showAdd && (
        <AddFoodModal
          mealLabel={mealLabel}
          editItem={null}
          draftCount={draft.length}
          onAdd={(item) => onAddToDraft(item)}
          onUpdate={async () => ({ error: null })}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editItem && (
        <AddFoodModal
          mealLabel={mealLabel}
          editItem={editItem}
          draftCount={draft.length}
          onAdd={() => {}}
          onUpdate={onUpdateSaved}
          onClose={() => setEditItem(null)}
        />
      )}
      {showAi && (
        <MealAiModal mealLabel={mealLabel} onAddMany={onAddManyToDraft} onClose={() => setShowAi(false)} />
      )}
    </div>
  )
}
