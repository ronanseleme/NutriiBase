import { PlanSelector } from '../PlanSelector'

interface Props {
  onBack: () => void
  onFinish: () => void
  onProfileRefresh: () => void
}

// Se a pessoa escolher cartão (Stripe) e não terminar o pagamento (fechar
// a aba), ela simplesmente cai como Free na próxima vez que abrir o app —
// role só vira 'pro' via webhook quando o pagamento é confirmado. Já o Pix
// (Mercado Pago) confirma sem sair da tela — o modal chama onProfileRefresh
// assim que o pagamento é detectado, então o role atualiza na hora.
export function StepPlan({ onBack, onFinish, onProfileRefresh }: Props) {
  return (
    <div className="nb-card">
      <h2 className="mb-1 text-[1.15rem] font-bold">Escolha sua licença</h2>
      <p className="mb-4 text-[0.84rem] text-[var(--text-soft)]">
        Assine o Pro e desbloqueie descrever refeições com IA (texto e voz), chat nutricional e insights personalizados. Ou continue no
        Free e assine quando quiser.
      </p>
      <PlanSelector
        onProfileRefresh={onProfileRefresh}
        footer={
          <button type="button" onClick={onFinish} className="mt-3 w-full py-1 text-center text-[0.82rem] font-semibold text-[var(--text-soft)] underline underline-offset-2">
            Continuar no Free
          </button>
        }
      />
      <button type="button" onClick={onBack} className="nb-btn nb-btn-secondary mt-3 w-full py-2.5 text-sm">
        Voltar
      </button>
    </div>
  )
}
