import { MEALS } from '../../lib/constants'
import { MEAL_ICONS } from './mealIcons'
import type { MealKey } from '../../types'

function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

interface Props {
  kcalByMeal: Record<MealKey, number>
  onPick: (mealKey: MealKey) => void
  onClose: () => void
}

// Passo 1 do fluxo "Adicionar Refeição": só escolhe QUAL refeição. O passo
// 2 (base de dados / manual / IA) já existe dentro do AddFoodModal — quem
// chama este picker abre o AddFoodModal em seguida para a refeição escolhida.
export function AddMealPicker({ kcalByMeal, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <div className="nb-modal w-full max-w-md">
        <h2 className="mb-1 text-[1.2rem] font-bold">Adicionar refeição</h2>
        <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">Em qual refeição você quer adicionar um alimento?</p>

        <div className="grid grid-cols-3 gap-2">
          {MEALS.map((m) => {
            const Icon = MEAL_ICONS[m.key]
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onPick(m.key)}
                className="group flex flex-col items-center gap-1 rounded-2xl border border-[var(--line-strong)] bg-[var(--bg)] py-3 text-[0.72rem] font-semibold transition-all hover:border-transparent hover:bg-[image:var(--brand-gradient)] hover:text-white"
              >
                <Icon />
                <span className="text-center leading-tight">{m.label}</span>
                <span className="text-[0.66rem] text-[var(--text-soft)] group-hover:text-white/80">
                  {fmtNum(kcalByMeal[m.key])} kcal
                </span>
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onClose} className="nb-btn nb-btn-secondary mt-4 w-full py-2.5">
          Cancelar
        </button>
      </div>
    </div>
  )
}
