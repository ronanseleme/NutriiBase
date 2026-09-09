interface Props {
  size?: number
  withWordmark?: boolean
  className?: string
}

/**
 * Marca geométrica: monograma "N" em branco sobre um selo com gradiente
 * laranja→azul (as cores de marca do NutriiBase), como um único polígono.
 */
export function Logo({ size = 32, withWordmark = true, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="nb-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--orange)" />
            <stop offset="1" stopColor="var(--blue)" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#nb-logo-grad)" />
        <polygon
          points="10,10 16,10 16,22 24,10 30,10 30,30 24,30 24,18 16,30 10,30"
          fill="white"
        />
      </svg>
      {withWordmark && (
        <span className="font-[Space_Grotesk] text-[1.15rem] font-bold tracking-tight text-[var(--text)]">
          Nutrii<span className="text-[var(--orange)]">Base</span>
        </span>
      )}
    </div>
  )
}
