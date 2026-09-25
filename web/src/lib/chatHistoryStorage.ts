// Guarda o histórico do Chat IA no localStorage do navegador — puramente
// client-side, não grava nada no Supabase. Isso mantém o impacto em
// "memória" praticamente zero: é só texto (poucos KB), limitado a um
// número máximo de mensagens, some sozinho depois de 24h, e nunca gera
// tráfego nem custo de banco — só ocupa um pedacinho do armazenamento local
// do próprio navegador da pessoa, específico desse dispositivo.

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  chips?: string[]
}

interface StoredChat {
  startedAt: string
  messages: StoredMessage[]
}

const TTL_MS = 24 * 60 * 60 * 1000
const MAX_STORED_MESSAGES = 40

function storageKey(userId: string): string {
  return `nb_chat_${userId}`
}

// Filtra o placeholder "Pensando…" antes de persistir — se a pessoa recarregar
// a página no meio de uma resposta, não queremos que ela volte travada nesse
// estado transitório.
function isPlaceholder(m: StoredMessage): boolean {
  return m.role === 'assistant' && m.content === 'Pensando…'
}

export function loadChatHistory(userId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredChat
    if (!parsed.startedAt || Date.now() - new Date(parsed.startedAt).getTime() > TTL_MS) {
      localStorage.removeItem(storageKey(userId))
      return []
    }
    return Array.isArray(parsed.messages) ? parsed.messages : []
  } catch {
    return []
  }
}

export function saveChatHistory(userId: string, messages: StoredMessage[]): void {
  const clean = messages.filter((m) => !isPlaceholder(m))
  if (!clean.length) return
  try {
    const key = storageKey(userId)
    let startedAt = new Date().toISOString()
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const existing = JSON.parse(raw) as StoredChat
        if (existing.startedAt) startedAt = existing.startedAt
      } catch {
        // valor corrompido — começa uma nova janela de 24h
      }
    }
    const trimmed = clean.slice(-MAX_STORED_MESSAGES)
    localStorage.setItem(key, JSON.stringify({ startedAt, messages: trimmed }))
  } catch {
    // localStorage indisponível (aba anônima, quota cheia etc.) — o chat
    // continua funcionando normalmente, só sem persistir entre sessões.
  }
}
