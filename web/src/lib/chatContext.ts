import { addDays, formatDateLabel, todayISO, toISODate } from './dateUtils'
import type { DayInsightData } from './insights'
import type { Profile } from '../types'

export function buildChatContext(profile: Profile, recentMap: Record<string, DayInsightData>): string {
  const t = profile.targets
  const lines: string[] = []

  lines.push(
    `Perfil do usuário: ${profile.name}, ${profile.age} anos, ${profile.sex === 'M' ? 'masculino' : 'feminino'}, ${profile.heightCm} cm, ${profile.weightKg} kg. Nível de atividade: ${profile.activity}. Objetivo: ${profile.goal} (ritmo ${profile.pace}).`,
  )
  if (profile.targetWeightKg) {
    lines.push(`Peso-meta: ${profile.targetWeightKg} kg${profile.targetDate ? ` até ${profile.targetDate}` : ''}.`)
  }
  const restr = [
    ...(profile.restrictions?.tags || []),
    ...(profile.restrictions?.note ? [profile.restrictions.note] : []),
  ]
  if (restr.length) lines.push(`Restrições alimentares: ${restr.join(', ')}.`)
  lines.push(
    `Meta diária calculada: ${t.kcal} kcal (TMB ${t.tmb}, GET ${t.get}), proteína ${t.protein}g, carboidrato ${t.carb}g, gordura ${t.fat}g.`,
  )

  const todayIso = todayISO()
  const todayData = recentMap[todayIso]
  if (todayData && (todayData.kcal > 0 || todayData.workoutKcal > 0 || todayData.weight != null)) {
    const metaAjustadaHoje = t.kcal + todayData.workoutKcal
    const restanteHoje = metaAjustadaHoje - todayData.kcal
    lines.push(
      `HOJE (${formatDateLabel(todayIso)}): consumiu ${todayData.kcal} kcal de uma meta ajustada de ${metaAjustadaHoje} kcal (meta base ${t.kcal} kcal + ${todayData.workoutKcal} kcal de exercício já feito hoje) — ` +
        (restanteHoje >= 0
          ? `ainda faltam ${restanteHoje} kcal para bater a meta de hoje.`
          : `já ultrapassou a meta de hoje em ${Math.abs(restanteHoje)} kcal.`) +
        ` Proteína hoje: ${todayData.protein} de ${t.protein} g. Carboidratos: ${todayData.carbs} de ${t.carb} g. Gordura: ${todayData.fat} de ${t.fat} g.` +
        (todayData.weight != null ? ` Peso registrado hoje: ${todayData.weight} kg.` : ''),
    )
  }

  const recent: string[] = []
  for (let i = 6; i >= 1; i--) {
    const iso = toISODate(addDays(new Date(), -i))
    const d = recentMap[iso]
    if (!d) continue
    const dHasData = d.kcal > 0 || d.workoutKcal > 0 || d.weight != null
    if (!dHasData) continue
    recent.push(
      `${formatDateLabel(iso)}: consumiu ${d.kcal} kcal, meta ${t.kcal + d.workoutKcal} kcal (com exercício)${d.weight != null ? `, peso ${d.weight} kg` : ''}`,
    )
  }
  if (recent.length) lines.push(`Histórico dos últimos dias:\n${recent.join('\n')}`)

  return lines.join('\n')
}
