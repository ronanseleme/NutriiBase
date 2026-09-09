import { useState } from 'react'
import { callChatAI, mapChatAIErrorCode, ChatAIError, type ChatTurn } from '../../lib/chatAI'

interface Message {
  role: 'user' | 'assistant'
  content: string
  chips?: string[]
}

interface Props {
  context: string
}

export function ChatPanel({ context }: Props) {
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

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
      const message = mapChatAIErrorCode(err instanceof ChatAIError ? err.code : 'upstream_error')
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
      <div className="nb-card-title">Assistente nutricional</div>
      <div className="mb-3 flex max-h-[420px] flex-col gap-2.5 overflow-y-auto">
        {history.length === 0 && (
          <p className="text-[0.86rem] text-[var(--text-soft)]">
            Pergunte algo sobre sua alimentação, treino ou meta — o assistente conhece seu perfil e seu histórico
            recente.
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-[0.86rem] ${
              m.role === 'user' ? 'self-end bg-[var(--blue)] text-white' : 'self-start bg-[var(--bg)] text-[var(--text)]'
            }`}
          >
            {m.content}
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
