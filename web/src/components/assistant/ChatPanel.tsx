import { useEffect, useState } from 'react'
import { callChatAI, mapChatAIErrorCode, ChatAIError, type ChatTurn } from '../../lib/chatAI'
import { loadChatHistory, saveChatHistory } from '../../lib/chatHistoryStorage'
import nutriiAvatar from '../../assets/nutrii-avatar.jpg'
import nutriiMascot from '../../assets/nutrii-mascot.jpg'

interface Message {
  role: 'user' | 'assistant'
  content: string
  chips?: string[]
}

interface Props {
  context: string
  userId: string | null
}

export function ChatPanel({ context, userId }: Props) {
  const [history, setHistory] = useState<Message[]>(() => (userId ? loadChatHistory(userId) : []))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Salva a conversa do dia no localStorage (some sozinha depois de 24h) —
  // só grava quando não há resposta em andamento, pra nunca persistir o
  // placeholder "Pensando…" nem sobrescrever com um estado intermediário.
  useEffect(() => {
    if (userId && !busy) saveChatHistory(userId, history)
  }, [userId, history, busy])

  async function send(rawText?: string) {
    const text = (rawText ?? input).trim()
    if (!text || busy) return
    setInput('')
    const withUser = [...history, { role: 'user' as const, content: text }]
    const placeholderIndex = withUser.length
    setHistory([...withUser, { role: 'assistant', content: 'Pensando…' }])
    setBusy(true)

    const turns: ChatTurn[] = withUser.slice(-8).map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await callChatAI(context, turns)
      setHistory((h) => {
        const copy = [...h]
        copy[placeholderIndex] = { role: 'assistant', content: res.reply, chips: res.chips }
        return copy
      })
    } catch (err) {
      const message =
        err instanceof ChatAIError ? mapChatAIErrorCode(err.code, err.message) : mapChatAIErrorCode('upstream_error')
      setHistory((h) => {
        const copy = [...h]
        copy[placeholderIndex] = { role: 'assistant', content: message }
        return copy
      })
    } finally {
      setBusy(false)
    }
  }

  const last = history[history.length - 1]
  const lastChips = last && last.role === 'assistant' ? last.chips : undefined

  return (
    <div className="nb-card">
      <div className="mb-3 flex items-center gap-2.5">
        <img src={nutriiAvatar} alt="Nutrii" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        <div>
          <div className="font-extrabold leading-tight">Nutrii</div>
          <div className="text-[0.72rem] text-[var(--text-soft)]">Assistente nutricional</div>
        </div>
      </div>
      <div className="mb-3 flex max-h-[420px] flex-col gap-2.5 overflow-y-auto">
        {history.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[var(--bg)] p-4 text-center">
            <img
              src={nutriiMascot}
              alt="Nutrii, o brócolis bombado, mascote do NutriiBase"
              className="h-36 w-auto rounded-[14px] object-cover shadow-[0_14px_30px_-16px_rgba(124,58,237,.45)]"
            />
            <div>
              <p className="text-[0.95rem] font-extrabold">Esse aqui é o Nutrii 🥦💪</p>
              <p className="mt-1 text-[0.84rem] text-[var(--text-soft)]">
                Nosso assistente nutricional! Pergunte sobre sua alimentação, treino ou metas — ele conhece seu
                perfil e seu histórico recente pra te ajudar na hora.
              </p>
            </div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'}`}>
            {m.role === 'assistant' && (
              <img src={nutriiAvatar} alt="Nutrii" className="h-6 w-6 shrink-0 rounded-full object-cover" />
            )}
            <div
              className={`max-w-[calc(85vw-5rem)] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-[0.86rem] sm:max-w-[360px] ${
                m.role === 'user' ? 'bg-[var(--blue)] text-white' : 'bg-[var(--bg)] text-[var(--text)]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {lastChips && lastChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lastChips.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(c)}
                className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--text-soft)] hover:bg-[var(--bg)]"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          disabled={busy}
          placeholder="Digite sua pergunta…"
          className="nb-input flex-1 rounded-full text-[0.86rem] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={busy || !input.trim()}
          aria-label="Enviar"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_22px_-10px_rgba(255,107,53,.6)] transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--accent-gradient)' }}
        >
          {busy ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}
