import { useEffect, useState } from 'react'
import { callDescribeMealAI, mapAIErrorCode, DescribeMealAIError, type AiFoodItem } from '../../lib/describeMealAI'
import { callTranscribeAudio, TranscribeAudioError } from '../../lib/transcribeAudio'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { uid } from '../../lib/uid'
import { CreditsBadge } from '../CreditsBadge'
import type { AiAccess, FoodItem } from '../../types'

interface ParsedItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
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
      per100: { kcal: (it.kcal / g) * 100, protein: (it.protein / g) * 100, carbs: (it.carbs / g) * 100, fat: (it.fat / g) * 100 },
    }
  })
}

interface Props {
  mealLabel: string
  access: AiAccess
  onAddMany: (items: FoodItem[]) => void
  onClose: () => void
}

export function MealAiModal({ mealLabel, access, onAddMany, onClose }: Props) {
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ParsedItem[]>([])
  const [transcribing, setTranscribing] = useState(false)
  const recorder = useAudioRecorder()

  useEffect(() => () => recorder.cancel(), [recorder.cancel])

  async function toggleRecording() {
    setError(null)
    if (recorder.status === 'recording') {
      const audio = await recorder.stop()
      if (!audio) return
      setTranscribing(true)
      try {
        const text = await callTranscribeAudio(audio)
        if (text.trim()) {
          setDesc((prev) => (prev.trim() ? `${prev.trim()} ${text.trim()}` : text.trim()))
        } else {
          setError('Não consegui entender o áudio. Tente falar de novo, mais perto do microfone.')
        }
      } catch (err) {
        setError(err instanceof TranscribeAudioError ? mapAIErrorCode(err.code, err.message) : mapAIErrorCode('upstream_error'))
      } finally {
        setTranscribing(false)
      }
      return
    }
    await recorder.start()
  }

  async function ask() {
    const text = desc.trim()
    if (!text) return
    setLoading(true)
    setError(null)
    setItems([])
    try {
      const result = await callDescribeMealAI(text)
      const parsed = toParsed(result)
      if (!parsed.length) setError('Não consegui identificar alimentos nessa descrição. Tente detalhar mais.')
      setItems(parsed)
    } catch (err) {
      setError(
        err instanceof DescribeMealAIError ? mapAIErrorCode(err.code, err.message) : mapAIErrorCode('upstream_error'),
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
        descricaoIa: desc,
      }))
    if (!entries.length) return
    onAddMany(entries)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal max-h-[88vh] w-full max-w-md overflow-auto">
        <h2 className="mb-1 text-[1.2rem] font-bold">Descrever refeição com IA</h2>
        <p className="mb-2 text-[0.84rem] text-[var(--text-soft)]">Descrevendo para: {mealLabel}</p>
        <CreditsBadge access={access} />

        <div className="relative mb-1">
          <textarea
            placeholder={
              access.role === 'free'
                ? 'Descreva tudo que você comeu nesta refeição. Ex: 2 ovos mexidos, uma fatia de pão integral, café com leite e uma banana'
                : 'Descreva tudo que você comeu nesta refeição, ou toque no microfone e fale. Ex: 2 ovos mexidos, uma fatia de pão integral, café com leite e uma banana'
            }
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={`nb-input min-h-14 ${access.role === 'free' ? '' : 'pr-11'}`}
          />
          {access.role !== 'free' && (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={transcribing}
              aria-label={recorder.status === 'recording' ? 'Parar gravação' : 'Falar em vez de digitar'}
              title={recorder.status === 'recording' ? 'Parar gravação' : 'Falar em vez de digitar'}
              className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                recorder.status === 'recording'
                  ? 'animate-pulse bg-[var(--coral)] text-white'
                  : 'text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--purple)]'
              }`}
            >
              {transcribing ? (
                <MicSpinnerIcon />
              ) : recorder.status === 'recording' ? (
                <StopIcon />
              ) : (
                <MicIcon />
              )}
            </button>
          )}
        </div>
        {access.role === 'free' && (
          <p className="mb-2 text-[0.72rem] text-[var(--text-soft)]">🎙️ Adicionar por voz é exclusivo Pro.</p>
        )}
        {recorder.status === 'recording' && (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_8%,var(--surface))] px-3 py-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--coral)]" />
            <div className="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true">
              {recorder.levels.map((v, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-[var(--coral)]"
                  style={{ height: `${Math.max(3, Math.round(v * 24))}px`, transition: 'height 80ms linear' }}
                />
              ))}
            </div>
            <span className="shrink-0 text-[0.72rem] font-semibold text-[var(--coral)]">Gravando…</span>
          </div>
        )}
        {transcribing && <p className="mb-2 text-[0.78rem] text-[var(--text-soft)]">Transcrevendo áudio…</p>}
        <button
          type="button"
          onClick={ask}
          disabled={loading || !desc.trim()}
          className="nb-btn nb-btn-blue mb-3 w-full py-2.5"
        >
          {loading ? 'Consultando IA…' : 'Descrever com IA'}
        </button>

        {(error || recorder.errorMessage) && (
          <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
            {error || recorder.errorMessage}
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
                  className="mb-2 w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 pr-8 font-semibold outline-none"
                />
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
          <button
            type="button"
            onClick={confirm}
            disabled={items.length === 0}
            className="nb-btn nb-btn-primary px-4 py-2 text-sm"
          >
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

function MicIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x={7} y={2} width={6} height={10} rx={3} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M4 9.5a6 6 0 0 0 12 0M10 15.5v2.5m-3 0h6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x={3} y={3} width={14} height={14} rx={2.5} fill="currentColor" />
    </svg>
  )
}

function MicSpinnerIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx={10} cy={10} r={7} stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}
