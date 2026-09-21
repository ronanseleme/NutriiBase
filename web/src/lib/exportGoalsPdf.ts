import type { jsPDF } from 'jspdf'
import type { Profile } from '../types'
import { formatGoalText } from './text'
import { getInitials } from './initials'

// Recurso Pro — gera o PDF inteiramente no navegador (sem Edge Function
// nova) a partir dos dados que a aba Metas já tem carregados. Import
// dinâmico: jspdf só entra no bundle de quem realmente clica em exportar
// ou compartilhar, em vez de pesar o carregamento inicial do app pra
// todo mundo.

const PAGE_W = 210
const MARGIN = 14

const COLOR = {
  purple: [124, 58, 237] as const,
  lavender: [139, 92, 246] as const,
  lilac: [167, 139, 250] as const,
  gold: [217, 119, 6] as const,
  teal: [5, 150, 105] as const,
  coral: [220, 38, 38] as const,
  text: [30, 24, 51] as const,
  textSoft: [107, 98, 132] as const,
  bg: [250, 248, 252] as const,
  line: [217, 207, 240] as const,
  white: [255, 255, 255] as const,
}

const ROLE_LABEL: Record<Profile['role'], string> = { admin: 'Admin', pro: 'Pro', free: 'Free' }

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Recorta a foto de perfil num quadrado central (object-fit: cover) antes
// de mandar pro jsPDF — sem isso, uma foto retangular ficaria esticada/
// distorcida dentro do círculo do cabeçalho.
async function fetchSquareAvatarDataUrl(url: string, size = 320): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

function statBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  label: string,
  color: readonly [number, number, number],
) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(value, x + w / 2, y + h / 2 - 1, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(label, x + w / 2, y + h / 2 + 6, { align: 'center' })
}

function progressBar(doc: jsPDF, x: number, y: number, w: number, pct: number, color: readonly [number, number, number]) {
  const clamped = Math.max(0, Math.min(100, pct))
  doc.setFillColor(...COLOR.line)
  doc.roundedRect(x, y, w, 3, 1.5, 1.5, 'F')
  if (clamped > 0) {
    doc.setFillColor(...color)
    doc.roundedRect(x, y, (w * clamped) / 100, 3, 1.5, 1.5, 'F')
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setTextColor(...COLOR.text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(text, MARGIN, y)
}

async function buildGoalsPdf(profile: Profile, startWeight: number, weekWorkoutCount: number): Promise<{ doc: jsPDF; filename: string }> {
  const { jsPDF: JsPdfCtor } = await import('jspdf')
  const doc = new JsPdfCtor()
  const t = profile.targets

  const [logoDataUrl, avatarDataUrl] = await Promise.all([
    fetchDataUrl(`${import.meta.env.BASE_URL}brand/logo-full-dark.png`),
    profile.avatarUrl ? fetchSquareAvatarDataUrl(profile.avatarUrl) : Promise.resolve(null),
  ])

  // ---------- Cabeçalho ----------
  const headerH = 46
  doc.setFillColor(...COLOR.purple)
  doc.rect(0, 0, PAGE_W, headerH, 'F')

  if (logoDataUrl) {
    const logoH = 9
    const logoW = logoH * (1837 / 576)
    doc.addImage(logoDataUrl, 'PNG', MARGIN, 9, logoW, logoH)
  } else {
    doc.setTextColor(...COLOR.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('NutriiBase', MARGIN, 16)
  }

  // Avatar — foto circular (se tiver) ou iniciais num círculo lilás.
  const avatarCx = PAGE_W - MARGIN - 12
  const avatarCy = 21
  const avatarR = 12
  doc.setFillColor(...COLOR.white)
  doc.circle(avatarCx, avatarCy, avatarR + 1.2, 'F')
  if (avatarDataUrl) {
    doc.saveGraphicsState()
    doc.circle(avatarCx, avatarCy, avatarR, null as unknown as string)
    ;(doc as unknown as { clip: () => jsPDF }).clip()
    ;(doc as unknown as { discardPath: () => jsPDF }).discardPath()
    doc.addImage(avatarDataUrl, 'JPEG', avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2)
    doc.restoreGraphicsState()
  } else {
    doc.setFillColor(...COLOR.lavender)
    doc.circle(avatarCx, avatarCy, avatarR, 'F')
    doc.setTextColor(...COLOR.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(getInitials(profile.name || 'Usuário'), avatarCx, avatarCy + 4.5, { align: 'center' })
  }

  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(profile.name || 'Usuário', MARGIN, 32)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const roleLabel = ROLE_LABEL[profile.role] || profile.role
  doc.text(`Plano ${roleLabel} · gerado em ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, MARGIN, 39)

  // ---------- Chips de informações pessoais ----------
  let y = headerH + 12
  doc.setFillColor(...COLOR.bg)
  const chips: string[] = [`${profile.age} anos`, profile.sex === 'M' ? 'Masculino' : 'Feminino', `${profile.heightCm} cm`, `${profile.weightKg} kg`]
  if (profile.bodyFatPct != null) chips.push(`${profile.bodyFatPct}% gordura`)
  let chipX = MARGIN
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const chip of chips) {
    const w = doc.getTextWidth(chip) + 8
    doc.setFillColor(...COLOR.bg)
    doc.setDrawColor(...COLOR.line)
    doc.roundedRect(chipX, y, w, 7, 3.5, 3.5, 'FD')
    doc.setTextColor(...COLOR.textSoft)
    doc.text(chip, chipX + w / 2, y + 4.7, { align: 'center' })
    chipX += w + 3
  }
  y += 16

  // ---------- Objetivo ----------
  sectionTitle(doc, 'Objetivo', y)
  y += 5
  const goalText = formatGoalText(profile.metaDescricao?.trim() || 'Sem objetivo personalizado definido.')
  doc.setFillColor(...COLOR.bg)
  doc.setDrawColor(...COLOR.purple)
  const goalLines = doc.splitTextToSize(goalText, PAGE_W - 2 * MARGIN - 10)
  const goalBoxH = goalLines.length * 5 + 8
  doc.roundedRect(MARGIN, y, PAGE_W - 2 * MARGIN, goalBoxH, 2, 2, 'F')
  doc.setFillColor(...COLOR.purple)
  doc.rect(MARGIN, y, 1.5, goalBoxH, 'F')
  doc.setTextColor(...COLOR.text)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(goalLines, MARGIN + 6, y + 6)
  y += goalBoxH + 12

  // ---------- Meta calórica e de macros ----------
  sectionTitle(doc, 'Meta calórica e de macros (por dia)', y)
  y += 6
  const boxW = (PAGE_W - 2 * MARGIN - 3 * 4) / 4
  const boxH = 22
  statBox(doc, MARGIN, y, boxW, boxH, `${Math.round(t.kcal)}`, 'Kcal', COLOR.gold)
  statBox(doc, MARGIN + (boxW + 4), y, boxW, boxH, `${Math.round(t.protein)}g`, 'Proteína', COLOR.purple)
  statBox(doc, MARGIN + 2 * (boxW + 4), y, boxW, boxH, `${Math.round(t.carb)}g`, 'Carboidrato', COLOR.lavender)
  statBox(doc, MARGIN + 3 * (boxW + 4), y, boxW, boxH, `${Math.round(t.fat)}g`, 'Gordura', COLOR.lilac)
  y += boxH + 12

  // ---------- Peso e composição corporal ----------
  sectionTitle(doc, 'Peso e composição corporal', y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLOR.text)
  const weightLines: string[] = [`Peso atual: ${profile.weightKg} kg  ·  Peso inicial registrado: ${startWeight} kg`]
  if (profile.targetWeightKg) weightLines.push(`Peso-meta: ${profile.targetWeightKg} kg`)
  if (profile.bodyFatPct != null) weightLines.push(`% gordura atual: ${profile.bodyFatPct}%`)
  if (profile.bodyFatTargetPct != null) weightLines.push(`% gordura-meta: ${profile.bodyFatTargetPct}%`)
  if (profile.targetDate) {
    weightLines.push(`Data-meta: ${new Intl.DateTimeFormat('pt-BR').format(new Date(profile.targetDate))}`)
  }
  for (const line of weightLines) {
    doc.text(line, MARGIN, y)
    y += 6
  }

  if (profile.targetWeightKg) {
    const totalDelta = startWeight - profile.targetWeightKg
    const doneDelta = startWeight - profile.weightKg
    const pct = totalDelta !== 0 ? Math.round((doneDelta / totalDelta) * 100) : 100
    y += 2
    progressBar(doc, MARGIN, y, PAGE_W - 2 * MARGIN, pct, pct >= 100 ? COLOR.teal : COLOR.purple)
    y += 7
    doc.setFontSize(8.5)
    doc.setTextColor(...COLOR.textSoft)
    doc.text(`${Math.max(0, Math.min(100, pct))}% do caminho até o peso-meta`, MARGIN, y)
    y += 10
  } else {
    y += 4
  }

  // ---------- Meta de treinos semanais ----------
  if (profile.weeklyWorkoutGoal) {
    sectionTitle(doc, 'Meta de treinos semanais', y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLOR.text)
    doc.text(`${weekWorkoutCount} de ${profile.weeklyWorkoutGoal} treinos esta semana`, MARGIN, y)
    y += 4
    const weekPct = Math.round((weekWorkoutCount / profile.weeklyWorkoutGoal) * 100)
    progressBar(doc, MARGIN, y, PAGE_W - 2 * MARGIN, weekPct, weekPct >= 100 ? COLOR.teal : COLOR.gold)
    y += 12
  }

  // ---------- Rodapé ----------
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.textSoft)
  doc.text('Gerado por NutriiBase · nutriibase.com.br', PAGE_W / 2, 290, { align: 'center' })

  const filename = `nutriibase-metas-${new Date().toISOString().slice(0, 10)}.pdf`
  return { doc, filename }
}

export async function exportGoalsPdf(profile: Profile, startWeight: number, weekWorkoutCount: number): Promise<void> {
  const { doc, filename } = await buildGoalsPdf(profile, startWeight, weekWorkoutCount)
  doc.save(filename)
}

// Gera o mesmo PDF e tenta abrir o menu nativo de compartilhamento
// (Web Share API, com arquivo anexado) — funciona em navegadores mobile
// modernos. Onde não há suporte (a maioria dos navegadores desktop),
// cai para o download normal, igual exportGoalsPdf.
export async function shareGoalsPdf(profile: Profile, startWeight: number, weekWorkoutCount: number): Promise<{ shared: boolean }> {
  const { doc, filename } = await buildGoalsPdf(profile, startWeight, weekWorkoutCount)
  const blob = doc.output('blob') as Blob
  const file = new File([blob], filename, { type: 'application/pdf' })

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void> }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Minhas metas — NutriiBase', text: 'Confira minhas metas no NutriiBase.' })
      return { shared: true }
    } catch (err) {
      // Usuário cancelou o compartilhamento — não é erro, só não faz nada.
      if ((err as Error)?.name === 'AbortError') return { shared: false }
      // Qualquer outro erro no compartilhamento: cai pro download normal abaixo.
    }
  }
  doc.save(filename)
  return { shared: false }
}
