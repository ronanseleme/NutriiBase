interface Props {
  size?: number
  variant?: 'full' | 'mark' | 'wordmark'
  className?: string
}

// Marca real do NutriiBase (arquivos em web/public/brand/), fornecida pelo
// usuário. logo-full.png é a versão nova (coração + haltere + folha, roxo/
// lavanda) do rebrand 2026; logo-mark.png/logo-wordmark.png ainda são a
// marca antiga (anel azul/folha verde) — só a "full" tem substituto novo
// até o momento, e é a única usada hoje (topbar + AuthScreen).
const MARK_RATIO = 1563 / 1606 // largura/altura de logo-mark.png
const FULL_RATIO = 850 / 359 // largura/altura de logo-full.png
const WORDMARK_RATIO = 1415 / 217 // largura/altura de logo-wordmark.png
const BRAND_URL = `${import.meta.env.BASE_URL}brand/`

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={`${BRAND_URL}logo-mark.png`}
      alt="NutriiBase"
      width={size}
      height={Math.round(size / MARK_RATIO)}
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}

export function LogoWordmark({ size = 32, className = '' }: { size?: number; className?: string }) {
  const height = Math.round(size * 0.62)
  return (
    <img
      src={`${BRAND_URL}logo-wordmark.png`}
      alt="NutriiBase"
      height={height}
      width={Math.round(height * WORDMARK_RATIO)}
      className={className}
      style={{ height, width: 'auto' }}
    />
  )
}

export function Logo({ size = 32, variant = 'full', className = '' }: Props) {
  if (variant === 'mark') return <LogoMark size={size} className={className} />
  if (variant === 'wordmark') return <LogoWordmark size={size} className={className} />
  return (
    <img
      src={`${BRAND_URL}logo-full.png`}
      alt="NutriiBase"
      height={size}
      width={Math.round(size * FULL_RATIO)}
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}
