import { supabase } from './supabase'

// Nome de arquivo fixo por usuário (com upsert) — cada novo upload
// substitui o anterior, sem acumular fotos antigas no bucket. Bucket
// público, então a URL devolvida já é utilizável direto num <img>. O
// "?t=" no final é cache-busting: sem ele, o navegador poderia continuar
// mostrando a foto antiga num re-upload, já que a URL em si não muda.
export async function uploadAvatarPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
