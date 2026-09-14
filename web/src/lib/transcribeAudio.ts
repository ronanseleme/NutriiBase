import { supabase } from './supabase'

export class TranscribeAudioError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export async function callTranscribeAudio(audio: Blob): Promise<string> {
  const audioBase64 = await blobToBase64(audio)
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { audioBase64, mimeType: audio.type || 'audio/webm' },
  })
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
    throw new TranscribeAudioError(message, code)
  }
  if (!data || typeof data.text !== 'string') {
    throw new TranscribeAudioError('Resposta inválida da IA', 'invalid_json')
  }
  return data.text
}
