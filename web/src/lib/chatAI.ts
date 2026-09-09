import { supabase } from './supabase'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export class ChatAIError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

async function invokeChatAssistant(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('chat-assistant', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    let code = 'upstream_error'
    let message = error.message
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json()
        code = parsed?.error?.code || code
        message = parsed?.error?.message || message
      } catch {
        // corpo não era JSON — mantém o fallback
      }
    }
    throw new ChatAIError(message, code)
  }
  return data
}

export async function callChatAI(context: string, messages: ChatTurn[]): Promise<{ reply: string; chips: string[] }> {
  const data = await invokeChatAssistant({ mode: 'chat', context, messages })
  if (!data || typeof data.reply !== 'string') {
    throw new ChatAIError('Resposta inválida da IA', 'invalid_json')
  }
  return { reply: data.reply, chips: Array.isArray(data.chips) ? data.chips.slice(0, 3) : [] }
}

export async function callInsightsAI(context: string): Promise<string[]> {
  const data = await invokeChatAssistant({ mode: 'insights', context })
  if (!data || !Array.isArray(data.tips)) {
    throw new ChatAIError('Resposta inválida da IA', 'invalid_json')
  }
  return data.tips as string[]
}

export function mapChatAIErrorCode(code: string): string {
  const map: Record<string, string> = {
    unauthorized: 'Sua sessão expirou — faça login de novo.',
    bad_request: 'Digite uma mensagem antes de enviar.',
    rate_limited: 'Muitas mensagens em pouco tempo — aguarde um instante e tente de novo.',
    invalid_json: 'Não consegui montar uma resposta agora. Tente novamente.',
    refused: 'Não consegui responder a essa pergunta. Tente reformular.',
    upstream_error: 'Tive um problema temporário para responder. Tente novamente.',
  }
  return map[code] || 'Não foi possível obter uma resposta agora.'
}
