import { supabase } from './supabase'

export interface AiFoodItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export class DescribeMealAIError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export async function callDescribeMealAI(descricao: string): Promise<AiFoodItem[]> {
  const { data, error } = await supabase.functions.invoke('describe-meal', { body: { descricao } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    let code = 'upstream_error'
    let message = error.message
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json()
        code = body?.error?.code || code
        message = body?.error?.message || message
      } catch {
        // corpo não era JSON — mantém o fallback
      }
    }
    throw new DescribeMealAIError(message, code)
  }
  if (!data || !Array.isArray(data.items)) {
    throw new DescribeMealAIError('Resposta inválida da IA', 'invalid_json')
  }
  return data.items as AiFoodItem[]
}

export function mapAIErrorCode(code: string): string {
  const map: Record<string, string> = {
    unauthorized: 'Sua sessão expirou — faça login de novo.',
    bad_request: 'Descreva o alimento antes de perguntar à IA.',
    rate_limited: 'Muitas solicitações em pouco tempo — aguarde um instante e tente de novo.',
    invalid_json: 'A IA não retornou um resultado utilizável. Tente descrever de outra forma.',
    refused: 'Não consegui identificar alimentos nessa descrição. Tente detalhar mais.',
    upstream_error: 'Problema temporário para consultar a IA. Tente novamente.',
  }
  return map[code] || 'Não foi possível obter uma estimativa agora.'
}
