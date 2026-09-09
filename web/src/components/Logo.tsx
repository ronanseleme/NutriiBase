interface Props {
  size?: number
  variant?: 'full' | 'mark' | 'wordmark'
  className?: string
}

/**
 * Marca NutriiBase: anel azul incompleto, folha verde com nervura branca e
 * um brilho laranja de 4 pontas preenchendo a abertura do anel — mais o
 * wordmark "Nutrii" (azul) + "Base" (verde).
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <path d="M79 26 A38 38 0 1 1 31 17" stroke="var(--blue)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M31 17 A38 38 0 0 1 47 12" stroke="var(--orange)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M66 16 A38 38 0 0 1 79 26" stroke="var(--orange)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path
        d="M56 4 L60.5 11.5 L68 16 L60.5 20.5 L56 28 L51.5 20.5 L44 16 L51.5 11.5 Z"
        fill="var(--orange)"
      />
      <path d="M24 78 Q71 67 80 20 Q33 31 24 78 Z" fill="var(--green)" />
      <path d="M28 74 Q61 57 76 23" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function LogoWordmark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-[Space_Grotesk] font-bold tracking-tight ${className}`}
      style={{ fontSize: size * 0.62 }}
    >
      <span style={{ color: 'var(--blue)' }}>Nutrii</span>
      <span style={{ color: 'var(--green)' }}>Base</span>
    </span>
  )
}

export function Logo({ size = 32, variant = 'full', className = '' }: Props) {
  if (variant === 'mark') return <LogoMark size={size} className={className} />
  if (variant === 'wordmark') return <LogoWordmark size={size} className={className} />
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <LogoWordmark size={size} />
    </div>
  )
}
