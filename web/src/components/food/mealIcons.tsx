import type { MealKey } from '../../types'

// Ícones pequenos por refeição, mesmo estilo de traço (viewBox 20x20,
// currentColor) usado no TabBar — dá pro seletor de refeição da aba
// Alimentação parecer o menu principal, e reaproveitado no picker do
// fluxo "Adicionar Refeição".

export function GeralIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x={2.5} y={3.5} width={15} height={13} rx={2} stroke="currentColor" strokeWidth={1.5} />
      <path d="M2.5 8h15M7 3.5v13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function CoffeeIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 8.5h9.5v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-4Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d="M13.5 9.5h1a2 2 0 0 1 0 4h-1" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M6.5 2.5c0 1-1 1-1 2s1 1 1 2M10 2.5c0 1-1 1-1 2s1 1 1 2" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx={10} cy={10} r={3.5} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 6.8c-1-1.6-3.6-2-4.9-.7-1.7 1.7-1.6 5.6.6 8.1 1 1.1 2 1.8 3 1.8s2.1-.6 3.1-1.8c1.6-1.9 2.2-4.6 1.3-6.6-.8-1.8-3-2.4-3.1-.8Z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M10 6.5c0-1.5.6-2.8 1.8-3.3" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M15.5 12.2A6 6 0 0 1 7.8 4.5a6.25 6.25 0 1 0 7.7 7.7Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StarsIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m8.5 3 1 2.6L12 6.6l-2.5 1 -1 2.6-1-2.6-2.5-1 2.5-1Z"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path d="M14.5 10.5v3.5M12.8 12.2h3.4" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  )
}

function BoltUpIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10.5 2.5 5 11h4l-1 6.5L15 9h-4l0.5-6.5Z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
}

function BoltCheckIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M9.5 2.5 4 11h4l-1 6.5L14 9h-4l0.5-6.5Z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M14.5 13.2 16 14.7l2.3-2.4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const MEAL_ICONS: Record<MealKey, () => React.ReactElement> = {
  cafeDaManha: CoffeeIcon,
  almoco: SunIcon,
  lanche: AppleIcon,
  jantar: MoonIcon,
  ceia: StarsIcon,
  preTreino: BoltUpIcon,
  posTreino: BoltCheckIcon,
}
