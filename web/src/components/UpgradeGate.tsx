interface Props {
  title?: string
  description?: string
}

export function UpgradeGate({
  title = 'Recurso exclusivo Pro',
  description = 'Assinantes Pro têm acesso ao assistente de IA para tirar dúvidas e descrever refeições automaticamente.',
}: Props) {
  return (
    <div className="nb-card text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: 'var(--accent-gradient)' }}>
        ✨
      </div>
      <div className="nb-card-title mb-1">{title}</div>
      <p className="mb-4 text-[0.86rem] text-[var(--text-soft)]">{description}</p>
      <button type="button" disabled className="nb-btn nb-btn-primary w-full px-4 py-2.5">
        Torne-se Pro (em breve)
      </button>
    </div>
  )
}
