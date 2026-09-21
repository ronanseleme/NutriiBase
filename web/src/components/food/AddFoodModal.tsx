import { useEffect, useState } from 'react'
import { FOODS, scaledFood, type FoodDbEntry } from '../../lib/foods'
import { foodIcon } from '../../lib/foodIcons'
import { uid } from '../../lib/uid'
import { CreditsBadge } from '../CreditsBadge'
import { callDescribeMealAI, mapAIErrorCode, DescribeMealAIError, type AiFoodItem as AiTextFoodItem } from '../../lib/describeMealAI'
import { callTranscribeAudio, TranscribeAudioError } from '../../lib/transcribeAudio'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import {
  callAnalyzeMealPhoto,
  uploadMealPhoto,
  mapAnalyzeMealPhotoErrorCode,
  AnalyzeMealPhotoError,
  type AiFoodItem as AiPhotoFoodItem,
} from '../../lib/analyzeMealPhotoAI'
import { compressImage, type CompressedImage } from '../../lib/compressImage'
import type { AiAccess, FoodItem } from '../../types'

type Mode = 'ai_text' | 'ai_photo' | 'db' | 'manual'

const GRID_COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

const CONFIDENCE_LABEL: Record<'alta' | 'media' | 'baixa', string> = {
  alta: 'Confiança alta',
  media: 'Confiança média',
  baixa: 'Confiança baixa — confira',
}

/**
 * Referência (gramas + macros) usada para recalcular kcal/macros quando o
 * usuário muda a quantidade em gramas no modo "manual". Sempre recalculamos
 * a partir desta âncora fixa (nunca a partir do último valor já arredondado
 * exibido em tela) para não acumular erro de arredondamento a cada edição
 * sucessiva de gramas — a mesma lógica que o modo "Base" (scaledFood) usa.
 */
interface MacroAnchor {
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

interface AiParsedItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence?: 'alta' | 'media' | 'baixa'
  per100: { kcal: number; protein: number; carbs: number; fat: number }
}

function toParsedAi(items: (AiTextFoodItem | AiPhotoFoodItem)[]): AiParsedItem[] {
  return items.map((it) => {
    const g = it.grams > 0 ? it.grams : 100
    return {
      name: it.name,
      grams: g,
      kcal: it.kcal,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      confidence: 'confidence' in it ? it.confidence : undefined,
      per100: { kcal: (it.kcal / g) * 100, protein: (it.protein / g) * 100, carbs: (it.carbs / g) * 100, fat: (it.fat / g) * 100 },
    }
  })
}

function updateAiListItem(
  list: AiParsedItem[],
  idx: number,
  field: 'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat',
  value: string,
): AiParsedItem[] {
  return list.map((it, i) => {
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
  })
}

interface Props {
  mealLabel: string
  editItem: FoodItem | null
  draftCount: number
  access: AiAccess
  userId: string | null
  onAdd: (item: FoodItem) => void
  onAddMany?: (items: FoodItem[]) => void
  onUpdate: (item: FoodItem) => Promise<{ error: Error | null }>
  onClose: () => void
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function AddFoodModal({ mealLabel, editItem, draftCount, access, userId, onAdd, onAddMany, onUpdate, onClose }: Props) {
  const isEdit = !!editItem
  const dbMatch = editItem?.grams != null ? FOODS.find((f) => f.name === editItem.name) : null
  const canPhoto = access.role !== 'free'

  const tabs: { key: Mode; label: string; icon: string }[] = isEdit
    ? []
    : [
        { key: 'ai_text', label: 'Descrever com IA', icon: '✨' },
        ...(canPhoto ? [{ key: 'ai_photo' as Mode, label: 'Foto com IA', icon: '📷' }] : []),
        { key: 'db', label: 'Base NutriiBase', icon: '🥗' },
        { key: 'manual', label: 'Manual', icon: '✍️' },
      ]
  const editTabs: { key: Mode; label: string; icon: string }[] = [
    { key: 'db', label: 'Base NutriiBase', icon: '🥗' },
    { key: 'manual', label: 'Manual', icon: '✍️' },
  ]
  const visibleTabs = isEdit ? editTabs : tabs

  const [mode, setMode] = useState<Mode>(isEdit && !dbMatch ? 'manual' : isEdit ? 'db' : 'ai_text')

  // --- Base NutriiBase / Manual (adiciona um item de cada vez) ---
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
  const [anchor, setAnchor] = useState<MacroAnchor | null>(
    editItem && !dbMatch && editItem.grams
      ? { grams: editItem.grams, kcal: editItem.kcal, protein: editItem.protein, carbs: editItem.carbs, fat: editItem.fat }
      : null,
  )
  const [addedCount, setAddedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Descrever com IA (texto/voz — adiciona vários itens de uma vez) ---
  const [desc, setDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiItems, setAiItems] = useState<AiParsedItem[]>([])
  const [aiTranscribing, setAiTranscribing] = useState(false)
  const recorder = useAudioRecorder()
  useEffect(() => () => recorder.cancel(), [recorder.cancel])

  // --- Foto com IA (adiciona vários itens de uma vez) ---
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoCompressed, setPhotoCompressed] = useState<CompressedImage | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoItems, setPhotoItems] = useState<AiParsedItem[]>([])
  const [fotoPath, setFotoPath] = useState<string | null>(null)

  const results = (() => {
    const nq = normalize(search.trim())
    const list = nq ? FOODS.filter((f) => normalize(f.name).includes(nq)) : FOODS.slice(0, 12)
    return list.slice(0, 30)
  })()

  function selectFood(f: FoodDbEntry) {
    setSelected({ base: f, grams: 100 })
  }

  function handleGramsChange(newGrams: number) {
    if (anchor && anchor.grams > 0 && newGrams > 0) {
      const ratio = newGrams / anchor.grams
      setManual((m) => ({
        ...m,
        grams: String(newGrams),
        kcal: String(Math.round(anchor.kcal * ratio)),
        protein: String(Math.round(anchor.protein * ratio)),
        carbs: String(Math.round(anchor.carbs * ratio)),
        fat: String(Math.round(anchor.fat * ratio)),
      }))
      return
    }
    // Ainda não há âncora (primeira vez que gramas passa a fazer sentido) —
    // só registra o valor e usa os macros já presentes neste momento como
    // referência para futuras mudanças de gramas.
    setManual((m) => ({ ...m, grams: String(newGrams) }))
    if (newGrams > 0) {
      setAnchor({
        grams: newGrams,
        kcal: +manual.kcal || 0,
        protein: +manual.protein || 0,
        carbs: +manual.carbs || 0,
        fat: +manual.fat || 0,
      })
    }
  }

  function updateMacroField(field: 'kcal' | 'protein' | 'carbs' | 'fat', value: string) {
    setManual((m) => ({ ...m, [field]: value }))
    const grams = +manual.grams || 0
    if (grams > 0) {
      setAnchor({
        grams,
        kcal: field === 'kcal' ? +value || 0 : +manual.kcal || 0,
        protein: field === 'protein' ? +value || 0 : +manual.protein || 0,
        carbs: field === 'carbs' ? +value || 0 : +manual.carbs || 0,
        fat: field === 'fat' ? +value || 0 : +manual.fat || 0,
      })
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

  async function toggleRecording() {
    setAiError(null)
    if (recorder.status === 'recording') {
      const audio = await recorder.stop()
      if (!audio) return
      setAiTranscribing(true)
      try {
        const text = await callTranscribeAudio(audio)
        if (text.trim()) {
          setDesc((prev) => (prev.trim() ? `${prev.trim()} ${text.trim()}` : text.trim()))
        } else {
          setAiError('Não consegui entender o áudio. Tente falar de novo, mais perto do microfone.')
        }
      } catch (err) {
        setAiError(err instanceof TranscribeAudioError ? mapAIErrorCode(err.code, err.message) : mapAIErrorCode('upstream_error'))
      } finally {
        setAiTranscribing(false)
      }
      return
    }
    await recorder.start()
  }

  async function askAi() {
    const text = desc.trim()
    if (!text) return
    setAiLoading(true)
    setAiError(null)
    setAiItems([])
    try {
      const result = await callDescribeMealAI(text)
      const parsed = toParsedAi(result)
      if (!parsed.length) setAiError('Não consegui identificar alimentos nessa descrição. Tente detalhar mais.')
      setAiItems(parsed)
    } catch (err) {
      setAiError(err instanceof DescribeMealAIError ? mapAIErrorCode(err.code, err.message) : mapAIErrorCode('upstream_error'))
    } finally {
      setAiLoading(false)
    }
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(null)
    setPhotoItems([])
    setFotoPath(null)
    try {
      const c = await compressImage(file)
      setPhotoCompressed(c)
      setPhotoPreview(URL.createObjectURL(c.blob))
    } catch {
      setPhotoError('Não foi possível processar essa foto. Tente outra.')
    }
  }

  async function analyzePhoto() {
    if (!photoCompressed) return
    setPhotoLoading(true)
    setPhotoError(null)
    setPhotoItems([])
    try {
      const result = await callAnalyzeMealPhoto(photoCompressed.base64, photoCompressed.mimeType)
      const parsed = toParsedAi(result)
      if (!parsed.length) {
        setPhotoError('Não consegui identificar alimentos nessa foto. Tente outro ângulo ou mais luz.')
      } else {
        setPhotoItems(parsed)
        // Só guarda a foto depois de uma análise boa — evita acumular
        // fotos inválidas/borradas no Storage.
        if (userId) {
          uploadMealPhoto(userId, photoCompressed.blob)
            .then(setFotoPath)
            .catch(() => {
              // Falha ao subir a foto não impede adicionar os alimentos —
              // só fica sem a referência visual dessa vez.
            })
        }
      }
    } catch (err) {
      setPhotoError(
        err instanceof AnalyzeMealPhotoError
          ? mapAnalyzeMealPhotoErrorCode(err.code, err.message)
          : mapAnalyzeMealPhotoErrorCode('upstream_error'),
      )
    } finally {
      setPhotoLoading(false)
    }
  }

  async function handleConfirm() {
    if (mode === 'ai_text') {
      const entries = aiItems
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
      onAddMany?.(entries)
      onClose()
      return
    }
    if (mode === 'ai_photo') {
      const entries = photoItems
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
      onAddMany?.(entries)
      onClose()
      return
    }

    const entry = buildEntry()
    if (!entry) return
    if (isEdit) {
      setSaving(true)
      setError(null)
      const { error: updateError } = await onUpdate(entry)
      setSaving(false)
      // Prefere a mensagem real do banco (ex: limite de 1 edição/item do
      // Free) — só cai no texto genérico se não vier nenhuma.
      if (updateError) setError(updateError.message || 'Não foi possível salvar, tente novamente.')
      else onClose()
      return
    }
    onAdd(entry)
    setAddedCount((c) => c + 1)
    // reset para o próximo item, mantém o modal aberto
    setSearch('')
    setSelected(null)
    setManual({ name: '', grams: '', kcal: '', protein: '', carbs: '', fat: '' })
    setAnchor(null)
    setMode('db')
  }

  const confirmEnabled =
    mode === 'ai_text' ? aiItems.length > 0 : mode === 'ai_photo' ? photoItems.length > 0 : mode === 'db' ? !!selected : manual.name.trim().length > 0
  const confirmLabel =
    mode === 'ai_text' || mode === 'ai_photo' ? 'Adicionar ao rascunho' : saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar ao rascunho'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal max-h-[88vh] w-full max-w-md overflow-auto">
        <h2 className="mb-1 text-[1.2rem] font-bold">{isEdit ? 'Editar alimento' : 'Adicionar alimento'}</h2>
        <p className="mb-3 text-[0.84rem] text-[var(--text-soft)]">
          {isEdit ? `Editando em: ${mealLabel}` : `Adicionando a: ${mealLabel} — ${draftCount} item(ns) no rascunho`}
        </p>

        {!isEdit && <CreditsBadge access={access} />}

        <div className={`mb-4 grid gap-1.5 ${GRID_COLS[visibleTabs.length] || 'grid-cols-2'}`}>
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-center text-[0.64rem] font-bold leading-tight transition-colors ${
                mode === t.key ? 'bg-[image:var(--blue-gradient)] text-white' : 'bg-[var(--surface)] text-[var(--text-soft)] hover:bg-[var(--bg)]'
              }`}
            >
              <span className="text-[0.95rem]">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {mode === 'ai_text' && (
          <AiTextTab
            access={access}
            desc={desc}
            setDesc={setDesc}
            loading={aiLoading}
            error={aiError}
            items={aiItems}
            transcribing={aiTranscribing}
            recorderStatus={recorder.status}
            recorderLevels={recorder.levels}
            recorderErrorMessage={recorder.errorMessage}
            onToggleRecording={toggleRecording}
            onAsk={askAi}
            onChangeField={(idx, field, value) => setAiItems((list) => updateAiListItem(list, idx, field, value))}
            onRemoveItem={(idx) => setAiItems((list) => list.filter((_, i) => i !== idx))}
          />
        )}

        {mode === 'ai_photo' && (
          <AiPhotoTab
            preview={photoPreview}
            hasCompressed={!!photoCompressed}
            loading={photoLoading}
            error={photoError}
            items={photoItems}
            onFile={handlePhotoFile}
            onAnalyze={analyzePhoto}
            onChangeField={(idx, field, value) => setPhotoItems((list) => updateAiListItem(list, idx, field, value))}
            onRemoveItem={(idx) => setPhotoItems((list) => list.filter((_, i) => i !== idx))}
          />
        )}

        {mode === 'db' && (
          <div>
            <input
              type="text"
              placeholder="Buscar alimento (ex: arroz, frango, banana)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nb-input mb-3"
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
                  <span>
                    <span aria-hidden="true">{foodIcon(f.name)}</span> {f.name}
                  </span>
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
                    className="nb-input bg-[var(--surface)] py-2"
                  />
                </label>
                <PreviewMacros m={scaledFood(selected.base, selected.grams)} />
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <ManualFields manual={manual} setManual={setManual} onGramsChange={handleGramsChange} onFieldChange={updateMacroField} />
        )}

        {error && (
          <div className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="nb-btn nb-btn-secondary px-4 py-2 text-sm">
            {!isEdit && addedCount > 0 ? 'Concluído' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!confirmEnabled || saving}
            className="nb-btn nb-btn-primary px-4 py-2 text-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function AiTextTab({
  access,
  desc,
  setDesc,
  loading,
  error,
  items,
  transcribing,
  recorderStatus,
  recorderLevels,
  recorderErrorMessage,
  onToggleRecording,
  onAsk,
  onChangeField,
  onRemoveItem,
}: {
  access: AiAccess
  desc: string
  setDesc: (fn: (d: string) => string) => void
  loading: boolean
  error: string | null
  items: AiParsedItem[]
  transcribing: boolean
  recorderStatus: 'idle' | 'recording' | 'error'
  recorderLevels: number[]
  recorderErrorMessage: string | null
  onToggleRecording: () => void
  onAsk: () => void
  onChangeField: (idx: number, field: 'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat', value: string) => void
  onRemoveItem: (idx: number) => void
}) {
  return (
    <div>
      <div className="relative mb-1">
        <textarea
          placeholder={
            access.role === 'free'
              ? 'Descreva tudo que você comeu nesta refeição. Ex: 2 ovos mexidos, uma fatia de pão integral, café com leite e uma banana'
              : 'Descreva tudo que você comeu nesta refeição, ou toque no microfone e fale. Ex: 2 ovos mexidos, uma fatia de pão integral, café com leite e uma banana'
          }
          value={desc}
          onChange={(e) => setDesc(() => e.target.value)}
          className={`nb-input min-h-14 ${access.role === 'free' ? '' : 'pr-11'}`}
        />
        {access.role !== 'free' && (
          <button
            type="button"
            onClick={onToggleRecording}
            disabled={transcribing}
            aria-label={recorderStatus === 'recording' ? 'Parar gravação' : 'Falar em vez de digitar'}
            title={recorderStatus === 'recording' ? 'Parar gravação' : 'Falar em vez de digitar'}
            className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              recorderStatus === 'recording'
                ? 'animate-pulse bg-[var(--coral)] text-white'
                : 'text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--purple)]'
            }`}
          >
            {transcribing ? <MicSpinnerIcon /> : recorderStatus === 'recording' ? <StopIcon /> : <MicIcon />}
          </button>
        )}
      </div>
      {access.role === 'free' && <p className="mb-2 text-[0.72rem] text-[var(--text-soft)]">🎙️ Adicionar por voz é exclusivo Pro.</p>}
      {recorderStatus === 'recording' && (
        <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_8%,var(--surface))] px-3 py-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--coral)]" />
          <div className="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true">
            {recorderLevels.map((v, i) => (
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
      <button type="button" onClick={onAsk} disabled={loading || !desc.trim()} className="nb-btn nb-btn-blue mb-3 w-full py-2.5">
        {loading ? 'Consultando IA…' : 'Descrever com IA'}
      </button>

      {(error || recorderErrorMessage) && (
        <div className="mb-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
          {error || recorderErrorMessage}
        </div>
      )}

      {items.length > 0 && (
        <div>
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">Confira e ajuste antes de adicionar</div>
          {items.map((it, idx) => (
            <AiItemCard key={idx} item={it} onChangeField={(field, value) => onChangeField(idx, field, value)} onRemove={() => onRemoveItem(idx)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AiPhotoTab({
  preview,
  hasCompressed,
  loading,
  error,
  items,
  onFile,
  onAnalyze,
  onChangeField,
  onRemoveItem,
}: {
  preview: string | null
  hasCompressed: boolean
  loading: boolean
  error: string | null
  items: AiParsedItem[]
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAnalyze: () => void
  onChangeField: (idx: number, field: 'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat', value: string) => void
  onRemoveItem: (idx: number) => void
}) {
  return (
    <div>
      <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" id="add-food-photo-input" />

      {!preview ? (
        <label
          htmlFor="add-food-photo-input"
          className="mb-3 flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--line-strong)] py-10 text-[var(--text-soft)]"
        >
          <span className="text-2xl">📷</span>
          <span className="text-[0.86rem] font-semibold">Tirar foto ou escolher da galeria</span>
        </label>
      ) : (
        <div className="mb-3">
          <img src={preview} alt="Prévia da foto" className="mb-2 max-h-56 w-full rounded-[12px] object-cover" />
          <div className="flex gap-2">
            <label
              htmlFor="add-food-photo-input"
              className="nb-btn nb-btn-secondary flex-1 cursor-pointer py-2 text-center text-sm"
            >
              Trocar foto
            </label>
            {!items.length && (
              <button type="button" onClick={onAnalyze} disabled={loading || !hasCompressed} className="nb-btn nb-btn-blue flex-1 py-2 text-sm">
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
          <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">Confira e ajuste antes de adicionar</div>
          {items.map((it, idx) => (
            <AiItemCard key={idx} item={it} onChangeField={(field, value) => onChangeField(idx, field, value)} onRemove={() => onRemoveItem(idx)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AiItemCard({
  item,
  onChangeField,
  onRemove,
}: {
  item: AiParsedItem
  onChangeField: (field: 'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat', value: string) => void
  onRemove: () => void
}) {
  return (
    <div className="relative mb-2.5 rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg)] p-3">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${item.name}`}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--coral)]"
      >
        ×
      </button>
      <input
        type="text"
        value={item.name}
        onChange={(e) => onChangeField('name', e.target.value)}
        className="mb-1.5 w-full rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1.5 pr-8 font-semibold outline-none"
      />
      {item.confidence && (
        <span
          className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${
            item.confidence === 'baixa'
              ? 'bg-[color-mix(in_srgb,var(--orange)_15%,var(--surface))] text-[var(--orange)]'
              : 'bg-[color-mix(in_srgb,var(--teal)_12%,var(--surface))] text-[var(--teal)]'
          }`}
        >
          {CONFIDENCE_LABEL[item.confidence]}
        </span>
      )}
      <label className="mb-2 flex max-w-[140px] flex-col gap-1">
        <span className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">Quantidade (g)</span>
        <input
          type="number"
          min={0}
          value={item.grams}
          onChange={(e) => onChangeField('grams', e.target.value)}
          className="rounded-[7px] border border-[var(--line-strong)] bg-[var(--surface)] px-2 py-1.5 text-[0.82rem]"
        />
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        <MiniField label="Kcal" value={item.kcal} onChange={(v) => onChangeField('kcal', v)} />
        <MiniField label="Prot" value={item.protein} onChange={(v) => onChangeField('protein', v)} />
        <MiniField label="Carb" value={item.carbs} onChange={(v) => onChangeField('carbs', v)} />
        <MiniField label="Gord" value={item.fat} onChange={(v) => onChangeField('fat', v)} />
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
      <path d="M4 9.5a6 6 0 0 0 12 0M10 15.5v2.5m-3 0h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
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
  onFieldChange,
}: {
  manual: ManualState
  setManual: (fn: (m: ManualState) => ManualState) => void
  onGramsChange: (g: number) => void
  onFieldChange: (field: 'kcal' | 'protein' | 'carbs' | 'fat', value: string) => void
}) {
  const inputCls = 'nb-input'
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
          <input type="number" min={0} value={manual.kcal} onChange={(e) => onFieldChange('kcal', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Proteína (g)</span>
          <input type="number" min={0} step={0.1} value={manual.protein} onChange={(e) => onFieldChange('protein', e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Carboidratos (g)</span>
          <input type="number" min={0} step={0.1} value={manual.carbs} onChange={(e) => onFieldChange('carbs', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-[var(--text-soft)]">Gordura (g)</span>
          <input type="number" min={0} step={0.1} value={manual.fat} onChange={(e) => onFieldChange('fat', e.target.value)} className={inputCls} />
        </label>
      </div>
    </div>
  )
}
