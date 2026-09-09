import { useState } from 'react'
import { monthLabel } from '../../lib/dateUtils'
import { computeInsightTips, computeMonthInsights, computeStreak, type DayInsightData } from '../../lib/insights'
import { callInsightsAI, mapChatAIErrorCode, ChatAIError } from '../../lib/chatAI'
import type { Profile } from '../../types'

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
function fmtSigned(n: number): string {
  const v = Number(n || 0)
  return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('pt-BR')
}

interface Props {
  profile: Profile
  monthMap: Record<string, DayInsightData>
  recentMap: Record<string, DayInsightData>
  y: number
  m: number
  onPrevMonth: () => void
  onNextMonth: () => void
  context: string
}

export function InsightsPanel({ profile, monthMap, recentMap, y, m, onPrevMonth, onNextMonth, context }: Props) {
  const [aiTips, setAiTips] = useState<string[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const info = computeMonthInsights(y, m, profile, monthMap)
  const t = profile.targets
  const maxAbs = Math.max(1, ...info.bars.map((b) => (b.saldo != null ? Math.abs(b.saldo) : 0)))

  let redistribuicao: string
  if (info.diasRestantes > 0) {
    const ajuste = Math.round((info.metaMensalSaldo - info.saldoAcumulado) / info.diasRestantes)
    const novaMeta = t.get + ajuste
    redistribuicao = `Nos ${info.diasRestantes} dias restantes do mês, para ainda bater o objetivo mensal sua meta ajustada seria de aproximadamente ${fmtNum(Math.round(novaMeta))} kcal/dia.`
  } else if (info.trackedCount > 0) {
    redistribuicao = `Mês encerrado — saldo calórico acumulado de ${fmtSigned(info.saldoAcumulado)} kcal em relação à meta.`
  } else {
    redistribuicao = 'Sem registros neste mês ainda.'
  }

  const streak = computeStreak(recentMap)
  const goodDays = info.bars.filter((b) => b.saldo != null && Math.abs(b.saldo) <= t.kcal * 0.1).length

  const focoTxt =
    (profile.goal === 'manutencao'
      ? 'Manutenção de peso'
      : profile.goal === 'emagrecimento'
        ? 'Emagrecimento'
        : 'Ganho de massa magra') + (profile.targetWeightKg ? ` — meta de ${profile.targetWeightKg} kg` : '')

  const tips = computeInsightTips(profile, recentMap)

  async function generateAiTips() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await callInsightsAI(context)
      setAiTips(result)
    } catch (err) {
      setAiError(mapChatAIErrorCode(err instanceof ChatAIError ? err.code : 'upstream_error'))
    } finally {
      setAiLoading(false)
    }
  }

  const cardCls = 'nb-card'

  return (
    <div className="flex flex-col gap-4">
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold"
          >
            ‹
          </button>
          <span className="font-[Space_Grotesk] font-bold">{monthLabel(y, m)}</span>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={info.isCurrentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line-strong)] font-bold disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-[18px] border-l-4 border-[var(--blue)] bg-[var(--surface)] p-4">
        <div className="text-[0.76rem] uppercase tracking-wide text-[var(--text-soft)]">Foco do mês</div>
        <div className="mt-1 text-[1.05rem] font-bold">{focoTxt}</div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 font-[Space_Grotesk] font-bold">Saldo calórico diário</div>
        <div className="flex items-end gap-[2px]">
          {info.bars.map((b) => {
            const h = b.saldo != null ? Math.max(3, Math.round((Math.abs(b.saldo) / maxAbs) * 40)) : 2
            const color = b.saldo == null ? 'var(--line)' : b.saldo > 0 ? 'var(--coral)' : 'var(--teal)'
            const title = b.saldo != null ? `${b.day}: ${fmtSigned(b.saldo)} kcal` : `${b.day}: sem dado`
            return (
              <div key={b.day} title={title} className="flex h-[52px] flex-1 flex-col items-center justify-end">
                <div className="w-3/5 rounded-t-[3px]" style={{ height: h, background: color }} />
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[0.8rem] text-[var(--text-soft)]">{redistribuicao}</p>
      </div>

      <div className={cardCls}>
        <div className="mb-3 font-[Space_Grotesk] font-bold">Peso no mês</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[1.05rem] font-extrabold">{fmtNum(info.pesoInicio)}</div>
            <div className="text-[0.68rem] text-[var(--text-soft)]">Início</div>
          </div>
          <div>
            <div className="text-[1.05rem] font-extrabold">{fmtNum(info.pesoAtual)}</div>
            <div className="text-[0.68rem] text-[var(--text-soft)]">Atual</div>
          </div>
          <div>
            <div className="text-[1.05rem] font-extrabold">{info.pesoMeta != null ? fmtNum(info.pesoMeta) : '—'}</div>
            <div className="text-[0.68rem] text-[var(--text-soft)]">Meta</div>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 font-[Space_Grotesk] font-bold">Consistência</div>
        <div className="flex flex-wrap gap-2">
          <span
            className="rounded-full px-3 py-1.5 text-[0.78rem] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--orange) 14%, var(--surface))', color: 'var(--orange)' }}
          >
            🔥 {streak} dias seguidos registrando
          </span>
          <span
            className="rounded-full px-3 py-1.5 text-[0.78rem] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--teal) 14%, var(--surface))', color: 'var(--teal)' }}
          >
            ✅ {goodDays} dias dentro da meta
          </span>
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 font-[Space_Grotesk] font-bold">Pontos de atenção</div>
        <div className="flex flex-col gap-2.5">
          {tips.map((tip, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-[1.1rem] leading-none">{tip.icon}</span>
              <div className="text-[0.84rem]">
                <b>{tip.title}</b> — {tip.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className="mb-3 font-[Space_Grotesk] font-bold">Recomendações da IA</div>
        <button
          type="button"
          onClick={generateAiTips}
          disabled={aiLoading}
          className="nb-btn nb-btn-blue w-full py-2.5"
        >
          {aiLoading ? 'Analisando seu perfil e histórico…' : 'Gerar dicas personalizadas'}
        </button>
        {aiError && (
          <div className="mt-3 rounded-[10px] bg-[color-mix(in_srgb,var(--coral)_10%,var(--surface))] p-2.5 text-[0.82rem] text-[var(--coral)]">
            {aiError}
          </div>
        )}
        {aiTips && aiTips.length > 0 && (
          <div className="mt-3 flex flex-col gap-2.5">
            {aiTips.map((tipText, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="text-[1.1rem] leading-none">💡</span>
                <div className="text-[0.84rem]">{tipText}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
