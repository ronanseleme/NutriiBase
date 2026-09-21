// Mesma convenção de código de plano usada em PLANO_HINT_DAYS
// (web/src/components/PlanSelector.tsx) — dias que a licença avulsa (Pix)
// vale pra cada plano. Usado pra achar o preço certo em list-plans (por
// "days") e pra saber quantos dias ativar depois que o Pix é confirmado.
export const PLAN_DAYS = { mensal: 30, trimestral: 90, semestral: 180, anual: 365 }
