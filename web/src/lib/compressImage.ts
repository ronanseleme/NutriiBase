// Redimensiona/comprime a foto no navegador antes de mandar pra IA — reduz
// o tamanho do payload (tokens da IA, tempo de upload) sem precisar de
// nenhuma lib nova, só Canvas API (já suportada em todo browser moderno).

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.75

export interface CompressedImage {
  blob: Blob
  base64: string
  mimeType: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Tira o prefixo "data:image/jpeg;base64," — a Edge Function e o
      // Gemini só querem os bytes.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Câmeras de celular tiram fotos enormes (12-50 MP, às vezes 15+ MB) — abrir
// isso com createImageBitmap(file) decodifica o bitmap em resolução TOTAL
// antes de reduzirmos no canvas, o que pode passar de 100 MB de memória de
// pico num navegador só nesse passo. Em celulares com pouca RAM livre (ou
// várias abas abertas) isso estoura e o navegador recusa com um erro de
// memória insuficiente. Se a 1ª tentativa (qualidade máxima) falhar, tenta
// de novo pedindo pro próprio navegador já decodificar reduzido — usa bem
// menos memória de pico que decodificar em tamanho total.
async function decodeAndCompress(file: File, resizeHint: boolean): Promise<CompressedImage> {
  const bitmap = resizeHint
    ? await createImageBitmap(file, { resizeWidth: MAX_DIMENSION, resizeQuality: 'medium' })
    : await createImageBitmap(file)

  const scale = resizeHint ? 1 : Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas não suportado neste navegador.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Não foi possível processar a foto.')

  const base64 = await blobToBase64(blob)
  return { blob, base64, mimeType: 'image/jpeg' }
}

export async function compressImage(file: File): Promise<CompressedImage> {
  try {
    return await decodeAndCompress(file, false)
  } catch {
    try {
      return await decodeAndCompress(file, true)
    } catch {
      throw new Error(
        'Essa foto é grande demais para o navegador processar agora (memória insuficiente). Feche outras abas/apps e tente de novo, ou tire a foto com resolução menor.',
      )
    }
  }
}
