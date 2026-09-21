import { supabase } from './supabase'
import { uid } from './uid'

export interface AiFoodItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: 'alta' | 'media' | 'baixa'
}

export class AnalyzeMealPhotoError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export async function callAnalyzeMealPhoto(imageBase64: string, mimeType: string): Promise<AiFoodItem[]> {
  const { data, error } = await supabase.functions.invoke('analyze-meal-photo', { body: { imageBase64, mimeType } })
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
    throw new AnalyzeMealPhotoError(message, code)
  }
  if (!data || !Array.isArray(data.items)) {
    throw new AnalyzeMealPhotoError('Resposta inválida da IA', 'invalid_json')
  }
  return data.items as AiFoodItem[]
}

// Sobe a foto (já comprimida) pro bucket privado meal-photos, sob o
// prefixo do próprio usuário (é o que a RLS do bucket exige). Devolve o
// caminho salvo — não a URL pública, porque o bucket não é público.
export async function uploadMealPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${uid()}.jpg`
  const { error } = await supabase.storage.from('meal-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getMealPhotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('meal-photos').createSignedUrl(path, 3600)
  if (error || !data) return null
  return data.signedUrl
}

export function mapAnalyzeMealPhotoErrorCode(code: string, serverMessage?: string): string {
  if ((code === 'invalid_image' || code === 'refused') && serverMessage) return serverMessage
  const map: Record<string, string> = {
    unauthorized: 'Sua sessão expirou — faça login de novo.',
    bad_request: 'Não foi possível processar essa foto.',
    rate_limited: 'Muitas solicitações em pouco tempo — aguarde um instante e tente de novo.',
    invalid_json: 'A IA não retornou um resultado utilizável. Tente outra foto.',
    refused: 'Não consegui identificar alimentos nessa foto.',
    invalid_image: 'Não consegui analisar essa foto. Tente outro ângulo ou mais luz.',
    forbidden_free: 'Recurso exclusivo para assinantes Pro.',
    upstream_error: 'Problema temporário para consultar a IA. Tente novamente.',
  }
  return map[code] || 'Não foi possível analisar a foto agora.'
}
