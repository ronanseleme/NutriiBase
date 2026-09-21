import { useRef, useState } from 'react'
import {
  callAnalyzeMealPhoto,
  uploadMealPhoto,
  mapAnalyzeMealPhotoErrorCode,
  AnalyzeMealPhotoError,
  type AiFoodItem,
} from '../../lib/analyzeMealPhotoAI'
import { compressImage, type CompressedImage } from '../../lib/compressImage'
import { uid } from '../../lib/uid'
import type { FoodItem } from '../../types'

interface ParsedItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: 'alta' | 'media' | 'baixa'
  per100: { kcal: number; protein: number; carbs: number; fat: number }
}

function toParsed(items: AiFoodItem[]): ParsedItem[] {
  return items.map((it) => {
    const g = it.grams > 0 ? it.grams : 100
    return {
      name: it.name,
      grams: g,
      kcal: it.kcal,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      confidence: it.confidence,
      per100: { kcal: (it.kcal / g) * 100, protein: (it.protein / g) * 100, carbs: (it.carbs / g) * 100, fat: (it.fat / g) * 100 },
    }
  })
}

const CONFIDENCE_LABEL: Record<ParsedItem['confidence'], string> = {
  alta: 'Confiança alta',
  media: 'Confiança média',
  baixa: 'Confiança baixa — confira',
}

interface Props {
  mealLabel: string
  userId: string | null
  onAddMany: (items: FoodItem[]) => void
  onClose: () => void
}

export function MealPhotoModal({ mealLabel, userId, onAddMany, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressed, setCompressed] = useState<CompressedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ParsedItem[]>([])
  const [fotoPath, setFotoPath] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setItems([])
    setFotoPath(null)
    try {
      const c = await compressImage(file)
      setCompressed(c)
      setPreview(URL.createObjectURL(c.blob))
    } catch {
      setError('Não foi possível processar essa foto. Tente outra.')
    }
  }

  async function analyze() {
    if (!compressed) return
    setLoading(true)
    setError(null)
    setItems([])
    try {
      const result = await callAnalyzeMealPhoto(compressed.base64, compressed.mimeType)
      const parsed = toParsed(result)
      if (!parsed.length) {
        setError('Não consegui identificar alimentos nessa foto. Tente outro ângulo ou mais luz.')
      } else {
        setItems(parsed)
        // Só guarda a foto depois de uma análise boa — evita acumular
        // fotos inválidas/borradas no Storage.
        if (userId) {
          uploadMealPhoto(userId, compressed.blob)
            .then(setFotoPath)
            .catch(() => {
              // Falha ao subir a foto não impede adicionar os alimentos —
              // só fica sem a referência visual dessa vez.
            })
        }
      }
    } catch (err) {
      setError(
        err instanceof AnalyzeMealPhotoError
          ? mapAnalyzeMealPhotoErrorCode(err.code, err.message)
          : mapAnalyzeMealPhotoErrorCode('upstream_error'),
      )
    } finally {
      setLoading(false)
    }
  }

  function updateField(idx: number, field: 'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat', value: string) {
    setItems((list) =>
      list.map((it, i) => {
        if (i !== idx) return it
        if (field === 'name') return { ...it, name: value }
        if (field === 'grams') {
          const g = Math.max(0, Math.round(+value || 0))
          return {
            ...it,
            grams: g,
            kcal: Math.round(it.per100.kcal * (g / 100)),
            protein: Math.round(it.per100.protein * (g / 100)),
            carbs: Math.round(it.per100.carbs * (g / 100)),
            fat: Math.round(it.per100.fat * (g / 100)),
          }
        }
        return { ...it, [field]: Math.max(0, Math.round(+value || 0)) }
      }),
    )
  }

  function removeItem(idx: number) {
    setItems((list) => list.filter((_, i) => i !== idx))
  }

  function confirm() {
    const entries: FoodItem[] = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        id: uid(),
        name: it.name.trim(),
        grams: it.grams > 0 ? it.grams : null,
        kcal: it.kcal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        fotoUrl: fotoPath,
      }))
    if (!entries.length) return
    onAddMany(entries)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal max-h-[88vh] w-full max-w-md overflow-auto">
        <h2 className="mb-1 text-[1.2rem] font-bold">Foto com IA</h2>
        <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">Adicionando a: {mealLabel}</p>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />

        {!preview ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mb-3 flex w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--line-strong)] py-10 text-[var(--text-soft)]"
          >
            <span className="text-2xl">📷</span>
            <span className="text-[0.86rem] font-semibold">Tirar foto ou escolher da galeria</span>
          </button>
        ) : (
          <div className="mb-3">
            <img src={preview} alt="Prévia da foto" className="mb-2 max-h-56 w-full rounded-[12px] object-cover" />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="nb-btn nb-btn-secondary flex-1 py-2 text-sm">
                Trocar foto
              </button>
              {!items.length && (
                <button type="button" onClick={analyze} disabled={loading} className="nb-btn nb-btn-blue flex-1 py-2 text-sm">
                  {loading ? 'Analisando…' : 'Analisar com IA'}
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
            {error}
          </div>
        )}

        {items.length > 0 && (
          <div>
            <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              Confira e ajuste antes de adicionar
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="relative mb-2.5 rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] p-3">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  aria-label={`Remover ${it.name}`}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--coral)]"
                >
                  ×
                </button>
                <input
                  type="text"
                  value={it.name}
                  onChange={(e) => updateField(idx, 'name', e.target.value)}
                  className="mb-1.5 w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 pr-8 font-semibold outline-none"
                />
                <span
                  className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
                    it.confidence === 'baixa'
                      ? 'bg-[color-mix(in_srgb,var(--orange)_15%,var(--surface))] text-[var(--orange)]'
                      : 'bg-[color-mix(in_srgb,var(--teal)_12%,var(--surface))] text-[var(--teal)]'
                  }`}
                >
                  {CONFIDENCE_LABEL[it.confidence]}
                </span>
                <label className="mb-2 flex max-w-[140px] flex-col gap-1">
                  <span className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">Quantidade (g)</span>
                  <input
                    type="number"
                    min={0}
                    value={it.grams}
                    onChange={(e) => updateField(idx, 'grams', e.target.value)}
                    className="rounded-[7px] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5 text-[0.82rem]"
                  />
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <MiniField label="Kcal" value={it.kcal} onChange={(v) => updateField(idx, 'kcal', v)} />
                  <MiniField label="Prot" value={it.protein} onChange={(v) => updateField(idx, 'protein', v)} />
                  <MiniField label="Carb" value={it.carbs} onChange={(v) => updateField(idx, 'carbs', v)} />
                  <MiniField label="Gord" value={it.fat} onChange={(v) => updateField(idx, 'fat', v)} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="nb-btn nb-btn-secondary px-4 py-2 text-sm">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={items.length === 0} className="nb-btn nb-btn-primary px-4 py-2 text-sm">
            Adicionar ao rascunho
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[7px] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5 text-[0.82rem]"
      />
    </label>
  )
}
