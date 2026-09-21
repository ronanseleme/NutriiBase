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

export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Não foi possível processar a foto.')

  const base64 = await blobToBase64(blob)
  return { blob, base64, mimeType: 'image/jpeg' }
}
