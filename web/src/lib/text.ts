// Tira um "Objetivo:" que a pessoa (ou o texto de exemplo) tenha colocado no
// início da frase, e garante a primeira letra maiúscula — usado tanto na
// aba Metas quanto no PDF exportado, pra manter o texto consistente.
export function formatGoalText(text: string): string {
  const stripped = text.replace(/^objetivo\s*:\s*/i, '').trim()
  return stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : stripped
}
