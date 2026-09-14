import { useTheme } from '../hooks/useTheme'

interface Props {
  size?: number
  variant?: 'full' | 'mark' | 'wordmark'
  className?: string
}

// Marca real do NutriiBase (arquivos em web/public/brand/), fornecida pelo
// usuário. A versão "full" tem uma imagem por tema — logo-full-light.png
// (roxo/preto, pro fundo claro) e logo-full-dark.png (branca, pro fundo
// escuro) — porque o texto "Nutrii" é preto numa versão e branco na outra,
// e ficaria ilegível no tema errado. logo-mark.png/logo-wordmark.png ainda
// são a marca antiga (anel azul/folha verde) — não usadas hoje (só a
// "full" é renderizada, no topbar e na AuthScreen).
const MARK_RATIO = 1563 / 1606 // largura/altura de logo-mark.png
const FULL_RATIO = 1837 / 576 // largura/altura de logo-full-light.png / logo-full-dark.png
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
  const { theme } = useTheme()
  if (variant === 'mark') return <LogoMark size={size} className={className} />
  if (variant === 'wordmark') return <LogoWordmark size={size} className={className} />
  return (
    <img
      src={`${BRAND_URL}${theme === 'dark' ? 'logo-full-dark.png' : 'logo-full-light.png'}`}
      alt="NutriiBase"
      height={size}
      width={Math.round(size * FULL_RATIO)}
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}
