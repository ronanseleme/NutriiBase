import type { Profile } from '../types'

// Recurso Pro — gera o PDF inteiramente no navegador (sem Edge Function
// nova) a partir dos dados que a aba Metas já tem carregados. Import
// dinâmico: jspdf só entra no bundle de quem realmente clica em exportar,
// em vez de pesar o carregamento inicial do app pra todo mundo.
export async function exportGoalsPdf(profile: Profile, startWeight: number, weekWorkoutCount: number) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const t = profile.targets
  let y = 20

  doc.setFontSize(18)
  doc.text('NutriiBase — Minhas Metas', 14, y)
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`${profile.name || 'Usuário'} · gerado em ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, 14, y)
  y += 12
  doc.setTextColor(0)

  doc.setFontSize(13)
  doc.text('Objetivo', 14, y)
  y += 6
  doc.setFontSize(10)
  const goalLines = doc.splitTextToSize(profile.metaDescricao?.trim() || 'Sem objetivo personalizado definido.', 180)
  doc.text(goalLines, 14, y)
  y += goalLines.length * 5 + 8

  doc.setFontSize(13)
  doc.text('Meta calórica e de macros (por dia)', 14, y)
  y += 7
  doc.setFontSize(10)
  doc.text(`Calorias: ${Math.round(t.kcal)} kcal`, 14, y)
  y += 6
  doc.text(`Proteína: ${Math.round(t.protein)} g`, 14, y)
  y += 6
  doc.text(`Carboidrato: ${Math.round(t.carb)} g`, 14, y)
  y += 6
  doc.text(`Gordura: ${Math.round(t.fat)} g`, 14, y)
  y += 10

  doc.setFontSize(13)
  doc.text('Peso e composição corporal', 14, y)
  y += 7
  doc.setFontSize(10)
  doc.text(`Peso atual: ${profile.weightKg} kg`, 14, y)
  y += 6
  doc.text(`Peso inicial registrado: ${startWeight} kg`, 14, y)
  y += 6
  if (profile.targetWeightKg) {
    doc.text(`Peso-meta: ${profile.targetWeightKg} kg`, 14, y)
    y += 6
  }
  if (profile.bodyFatPct != null) {
    doc.text(`% gordura atual: ${profile.bodyFatPct}%`, 14, y)
    y += 6
  }
  if (profile.bodyFatTargetPct != null) {
    doc.text(`% gordura-meta: ${profile.bodyFatTargetPct}%`, 14, y)
    y += 6
  }
  if (profile.targetDate) {
    doc.text(`Data-meta: ${new Intl.DateTimeFormat('pt-BR').format(new Date(profile.targetDate))}`, 14, y)
    y += 6
  }
  y += 4

  if (profile.weeklyWorkoutGoal) {
    doc.setFontSize(13)
    doc.text('Meta de treinos semanais', 14, y)
    y += 7
    doc.setFontSize(10)
    doc.text(`${weekWorkoutCount} de ${profile.weeklyWorkoutGoal} treinos esta semana`, 14, y)
  }

  doc.save(`nutriibase-metas-${new Date().toISOString().slice(0, 10)}.pdf`)
}
