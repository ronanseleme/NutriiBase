// Ponte mínima pra deixar componentes fora da árvore do App (ex: UpgradeGate,
// usado em vários modais/telas soltas) pedirem pra trocar de aba, sem ter
// que passar um callback de navegação por várias camadas de props. App.tsx
// registra o setter dele uma vez; quem quiser navegar só chama a função.
let goToProfile: (() => void) | null = null
let goToAddMeal: (() => void) | null = null

export function registerGoToProfile(fn: () => void) {
  goToProfile = fn
}

export function navigateToProfile() {
  goToProfile?.()
}

export function registerGoToAddMeal(fn: () => void) {
  goToAddMeal = fn
}

export function navigateToAddMeal() {
  goToAddMeal?.()
}
