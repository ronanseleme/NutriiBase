import { MEALS } from '../../lib/constants'
import { dayFoodTotals, mealTotals } from '../../lib/calculations'
import type { MealsByKey, Targets } from '../../types'

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

const SUGGESTION_POOL: Record<'protein' | 'carb' | 'fat', string[]> = {
  protein: ['Peito de frango grelhado', 'Ovo cozido', 'Iogurte grego', 'Whey protein (pó)'],
  carb: ['Batata doce cozida', 'Arroz integral cozido', 'Aveia em flocos', 'Banana'],
  fat: ['Abacate', 'Azeite de oliva', 'Castanha do Pará', 'Amendoim'],
}

function suggestion(totals: ReturnType<typeof dayFoodTotals>, targets: Targets): string {
  if (totals.kcal === 0) return 'Nenhum alimento registrado ainda hoje — que tal começar pelo café da manhã?'
  const ratios = {
    protein: targets.protein > 0 ? totals.protein / targets.protein : 1,
    carb: targets.carb > 0 ? totals.carbs / targets.carb : 1,
    fat: targets.fat > 0 ? totals.fat / targets.fat : 1,
  }
  const lowest = (Object.keys(ratios) as (keyof typeof ratios)[]).reduce((a, b) => (ratios[a] <= ratios[b] ? a : b))
  if (ratios[lowest] >= 0.9) return 'Seus macros estão bem equilibrados até agora hoje. 👏'
  const labels = { protein: 'Sua proteína', carb: 'Seu carboidrato', fat: 'Sua gordura' }
  const pool = SUGGESTION_POOL[lowest]
  const food = pool[Math.floor(Date.now() / 86400000) % pool.length]
  return `${labels[lowest]} está a ${Math.round(ratios[lowest] * 100)}% da meta até agora — que tal incluir ${food} na próxima refeição?`
}

export function MealSummary({ meals, targets }: { meals: MealsByKey; targets: Targets }) {
  const dayTotals = dayFoodTotals(meals)

  return (
    <div className="nb-card">
      <div className="nb-card-title">Resumo por refeição</div>
      <div className="mb-1.5 grid grid-cols-[1fr_repeat(5,44px)] gap-1 border-b border-[var(--line)] pb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-[var(--text-soft)]">
        <span />
        <span className="text-right">Gramas</span>
        <span className="text-right">Kcal</span>
        <span className="text-right" style={{ color: 'var(--protein)' }}>
          Prot
        </span>
        <span className="text-right" style={{ color: 'var(--carb)' }}>
          Carb
        </span>
        <span className="text-right" style={{ color: 'var(--fat)' }}>
          Gord
        </span>
      </div>
      {MEALS.map((m) => {
        const t = mealTotals(meals[m.key])
        const share = dayTotals.kcal > 0 ? Math.round((t.kcal / dayTotals.kcal) * 100) : 0
        return (
          <div key={m.key} className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 border-b border-[var(--line)] py-2 text-[0.82rem] last:border-b-0">
            <span>{m.label}</span>
            <span className="text-right font-semibold text-[var(--text-soft)]">{fmtNum(t.grams)}</span>
            <span className="text-right font-semibold">{fmtNum(t.kcal)}</span>
            <span className="text-right font-semibold" style={{ color: 'var(--protein)' }}>
              {fmtNum(t.protein)}
            </span>
            <span className="text-right font-semibold" style={{ color: 'var(--carb)' }}>
              {fmtNum(t.carbs)}
            </span>
            <span className="text-right font-semibold" style={{ color: 'var(--fat)' }}>
              {fmtNum(t.fat)}
            </span>
            <div className="col-span-6 mt-1 h-[5px] overflow-hidden rounded-full bg-[var(--line)]">
              {t.kcal > 0 && (
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share}%`, background: 'var(--blue-light)' }}
                  title={`${share}% do total do dia`}
                />
              )}
            </div>
          </div>
        )
      })}
      <div className="grid grid-cols-[1fr_repeat(5,44px)] items-center gap-1 border-t-2 border-[var(--line-strong)] pt-2.5 text-[0.85rem] font-extrabold">
        <span>Total</span>
        <span className="text-right text-[var(--text-soft)]">{fmtNum(dayTotals.grams)}</span>
        <span className="text-right">{fmtNum(dayTotals.kcal)}</span>
        <span className="text-right" style={{ color: 'var(--protein)' }}>
          {fmtNum(dayTotals.protein)}
        </span>
        <span className="text-right" style={{ color: 'var(--carb)' }}>
          {fmtNum(dayTotals.carbs)}
        </span>
        <span className="text-right" style={{ color: 'var(--fat)' }}>
          {fmtNum(dayTotals.fat)}
        </span>
      </div>
      <div className="mt-4 flex gap-2 rounded-[12px] bg-[var(--bg)] p-3 text-[0.82rem]">
        <span>💡</span>
        <span>{suggestion(dayTotals, targets)}</span>
      </div>
    </div>
  )
}
