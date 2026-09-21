import { useEffect, useState } from 'react'
import { Logo } from './Logo'

const AUTO_CONTINUE_SECONDS = 60

interface Props {
  onContinue: () => void
}

export function CheckoutSuccessScreen({ onContinue }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CONTINUE_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onContinue()
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, onContinue])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 text-center">
      <Logo size={36} />

      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
        style={{ background: 'color-mix(in srgb, var(--teal) 15%, var(--surface))' }}
      >
        ✅
      </div>

      <div className="max-w-xs">
        <h1 className="mb-2 text-[1.35rem] font-bold text-[var(--text)]">Pagamento confirmado!</h1>
        <p className="text-[0.9rem] text-[var(--text-soft)]">
          Obrigado por assinar o NutriiBase Pro. Sua conta já foi liberada — é só acessar o sistema pra começar a usar.
        </p>
      </div>

      <button type="button" onClick={onContinue} className="nb-btn nb-btn-primary w-full max-w-xs py-3 text-[0.95rem]">
        Acesse o Sistema
      </button>

      <p className="text-[0.76rem] text-[var(--text-soft)]">
        Você será redirecionado automaticamente em {secondsLeft}s…
      </p>
    </div>
  )
}
