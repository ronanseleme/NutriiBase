import { useState } from 'react'
import { FOODS, scaledFood, type FoodDbEntry } from '../../lib/foods'
import { callDescribeMealAI, mapAIErrorCode, DescribeMealAIError } from '../../lib/describeMealAI'
import { uid } from '../../lib/uid'
import type { FoodItem } from '../../types'

type Mode = 'db' | 'ai' | 'manual'

interface Props {
  mealLabel: string
  editItem: FoodItem | null
  draftCount: number
  onAdd: (item: FoodItem) => void
  onUpdate: (item: FoodItem) => Promise<{ error: Error | null }>
  onClose: () => void
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function AddFoodModal({ mealLabel, editItem, draftCount, onAdd, onUpdate, onClose }: Props) {
  const isEdit = !!editItem
  const dbMatch = editItem?.grams != null ? FOODS.find((f) => f.name === editItem.name) : null

  const [mode, setMode] = useState<Mode>(isEdit && !dbMatch ? 'manual' : 'db')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ base: FoodDbEntry; grams: number } | null>(
    dbMatch ? { base: dbMatch, grams: editItem!.grams! } : null,
  )
  const [manual, setManual] = useState({
    name: editItem && !dbMatch ? editItem.name : '',
    grams: editItem && !dbMatch && editItem.grams != null ? String(editItem.grams) : '',
    kcal: editItem && !dbMatch ? String(editItem.kcal) : '',
    protein: editItem && !dbMatch ? String(editItem.protein) : '',
    carbs: editItem && !dbMatch ? String(editItem.carbs) : '',
    fat: editItem && !dbMatch ? String(editItem.fat) : '',
  })
  const [lastGrams, setLastGrams] = useState(editItem && !dbMatch ? editItem.grams || 0 : 0)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiApplied, setAiApplied] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [saving, setSaving] = useState(false)

  const results = (() => {
    const nq = normalize(search.trim())
    const list = nq ? FOODS.filter((f) => normalize(f.name).includes(nq)) : FOODS.slice(0, 12)
    return list.slice(0, 30)
  })()

  function selectFood(f: FoodDbEntry) {
    setSelected({ base: f, grams: 100 })
  }

  function handleGramsChange(newGrams: number) {
    if (lastGrams > 0 && newGrams > 0 && newGrams !== lastGrams) {
      const ratio = newGrams / lastGrams
      setManual((m) => ({
        ...m,
        kcal: String(Math.round((+m.kcal || 0) * ratio)),
        protein: String(Math.round((+m.protein || 0) * ratio * 10) / 10),
        carbs: String(Math.round((+m.carbs || 0) * ratio * 10) / 10),
        fat: String(Math.round((+m.fat || 0) * ratio * 10) / 10),
      }))
    }
    setLastGrams(newGrams)
    setManual((m) => ({ ...m, grams: String(newGrams) }))
  }

  async function askAI() {
    const desc = aiDesc.trim()
    if (!desc) return
    setAiLoading(true)
    setAiError(null)
    try {
      const items = await callDescribeMealAI(desc)
      const data = items[0]
      if (data) {
        setManual({
          name: data.name.slice(0, 80),
          grams: String(data.grams || ''),
          kcal: String(data.kcal || 0),
          protein: String(data.protein || 0),
          carbs: String(data.carbs || 0),
          fat: String(data.fat || 0),
        })
        setLastGrams(data.grams || 0)
        setAiApplied(true)
      }
    } catch (err) {
      setAiError(mapAIErrorCode(err instanceof DescribeMealAIError ? err.code : 'upstream_error'))
    } finally {
      setAiLoading(false)
    }
  }

  function buildEntry(): FoodItem | null {
    if (mode === 'db') {
      if (!selected) return null
      const m = scaledFood(selected.base, selected.grams)
      return {
        id: editItem?.id || uid(),
        name: selected.base.name,
        grams: selected.grams,
        kcal: m.kcal,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      }
    }
    const name = manual.name.trim()
    if (!name) return null
    const gramsVal = +manual.grams || 0
    return {
      id: editItem?.id || uid(),
      name,
      grams: gramsVal > 0 ? gramsVal : null,
      kcal: Math.round(+manual.kcal || 0),
      protein: Math.round(+manual.protein || 0),
      carbs: Math.round(+manual.carbs || 0),
      fat: Math.round(+manual.fat || 0),
    }
  }

  async function handleConfirm() {
    const entry = buildEntry()
    if (!entry) return
    if (isEdit) {
      setSaving(true)
      const { error } = await onUpdate(entry)
      setSaving(false)
      if (!error) onClose()
      return
    }
    onAdd(entry)
    setAddedCount((c) => c + 1)
    // reset para o próximo item, mantém o modal aberto
    setSearch('')
    setSelected(null)
    setManual({ name: '', grams: '', kcal: '', protein: '', carbs: '', fat: '' })
    setLastGrams(0)
    setAiDesc('')
    setAiApplied(false)
    setAiError(null)
    setMode('db')
  }

  const confirmEnabled = mode === 'db' ? !!selected : manual.name.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-md overflow-auto rounded-[20px] bg-[var(--surface)] p-6 shadow-[0_20px_45px_-20px_rgba(43,43,51,.35)]">
        <h2 className="mb-1 text-[1.2rem] font-bold">{isEdit ? 'Editar alimento' : 'Adicionar alimento'}</h2>
        <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">
          {isEdit ? `Editando em: ${mealLabel}` : `Adicionando a: ${mealLabel} — ${draftCount} item(ns) no rascunho`}
        </p>

        <div className="mb-4 flex overflow-hidden rounded-[9px] border border-[var(--line-strong)]">
          {(['db', 'ai', 'manual'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-semibold ${mode === m ? 'bg-[var(--blue)] text-white' : 'bg-[var(--surface)]'}`}
            >
              {m === 'db' ? 'Base' : m === 'ai' ? 'Perguntar à IA' : 'Manual'}
            </button>
          ))}
        </div>

        {mode === 'db' && (
          <div>
            <input
              type="text"
              placeholder="Buscar alimento (ex: arroz, frango, banana)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)]"
            />
            <div className="mb-3 max-h-52 overflow-auto rounded-[10px] border border-[var(--line)]">
              {results.length === 0 && (
                <div className="p-3 text-[0.85rem] text-[var(--text-soft)]">Nenhum alimento encontrado. Tente "Manual".</div>
              )}
              {results.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => selectFood(f)}
                  className="flex w-full items-center justify-between border-b border-[var(--line)] px-3 py-2.5 text-left text-[0.85rem] last:border-b-0 hover:bg-[var(--bg)]"
                >
                  <span>{f.name}</span>
                  <span className="text-[0.75rem] text-[var(--text-soft)]">{f.kcal} kcal /100g</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className="mb-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
                <div className="mb-2 font-semibold">{selected.base.name}</div>
                <label className="mb-2 flex flex-col gap-1">
                  <span className="text-[0.78rem] font-bold text-[var(--text-soft)]">Quantidade (g)</span>
                  <input
                    type="number"
                    min={1}
                    value={selected.grams}
                    onChange={(e) => setSelected({ ...selected, grams: Math.max(1, +e.target.value || 1) })}
                    className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>
                <PreviewMacros m={scaledFood(selected.base, selected.grams)} />
              </div>
            )}
          </div>
        )}

        {mode === 'ai' && (
          <div className="mb-3">
            <textarea
              placeholder="Descreva o alimento e a porção. Ex: 2 fatias de pão integral com um ovo frito e queijo"
              value={aiDesc}
              onChange={(e) => setAiDesc(e.target.value)}
              className="mb-2 min-h-14 w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] p-2.5 outline-none focus:border-[var(--blue)]"
            />
            <button
              type="button"
              onClick={askAI}
              disabled={aiLoading || !aiDesc.trim()}
              className="mb-3 w-full rounded-[10px] bg-[var(--blue)] py-2.5 font-bold text-white disabled:opacity-60"
            >
              {aiLoading ? 'Consultando IA…' : 'Perguntar à IA'}
            </button>
            {aiError && <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">{aiError}</div>}
            {aiApplied && <ManualFields manual={manual} setManual={setManual} onGramsChange={handleGramsChange} />}
          </div>
        )}

        {mode === 'manual' && <ManualFields manual={manual} setManual={setManual} onGramsChange={handleGramsChange} />}

        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="rounded-[8px] border border-[var(--line-strong)] px-4 py-2 text-sm font-bold">
            {!isEdit && addedCount > 0 ? 'Concluído' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!confirmEnabled || saving}
            className="rounded-[8px] bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar ao rascunho'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewMacros({ m }: { m: { kcal: number; protein: number; carbs: number; fat: number } }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-[0.8rem] text-[var(--text-soft)]">
      <span>
        <b className="text-[var(--text)]">{m.kcal}</b> kcal
      </span>
      <span>
        <b className="text-[var(--text)]">{m.protein}</b> g prot
      </span>
      <span>
        <b className="text-[var(--text)]">{m.carbs}</b> g carb
      </span>
      <span>
        <b className="text-[var(--text)]">{m.fat}</b> g gord
      </span>
    </div>
  )
}

interface ManualState {
  name: string
  grams: string
  kcal: string
  protein: string
  carbs: string
  fat: string
}

function ManualFields({
  manual,
  setManual,
  onGramsChange,
}: {
  manual: ManualState
  setManual: (fn: (m: ManualState) => ManualState) => void
  onGramsChange: (g: number) => void
}) {
  const inputCls = 'rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:border-[var(--blue)] w-full'
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Nome do alimento</span>
        <input
          type="text"
          placeholder="Ex: Marmita da vovó"
          value={manual.name}
          onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Gramas (quantidade)</span>
        <input
          type="number"
          min={0}
          placeholder="Ex: 150"
          value={manual.grams}
          onChange={(e) => onGramsChange(Math.max(0, +e.target.value || 0))}
          className={inputCls}
        />
      </label>
      <p className="-mt-2 text-[0.78rem] text-[var(--text-soft)]">Mudar as gramas recalcula kcal e macros proporcionalmente.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Calorias (kcal)</span>
          <input type="number" min={0} value={manual.kcal} onChange={(e) => setManual((m) => ({ ...m, kcal: e.target.value }))} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Proteína (g)</span>
          <input type="number" min={0} step={0.1} value={manual.protein} onChange={(e) => setManual((m) => ({ ...m, protein: e.target.value }))} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Carboidratos (g)</span>
          <input type="number" min={0} step={0.1} value={manual.carbs} onChange={(e) => setManual((m) => ({ ...m, carbs: e.target.value }))} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Gordura (g)</span>
          <input type="number" min={0} step={0.1} value={manual.fat} onChange={(e) => setManual((m) => ({ ...m, fat: e.target.value }))} className={inputCls} />
        </label>
      </div>
    </div>
  )
}
