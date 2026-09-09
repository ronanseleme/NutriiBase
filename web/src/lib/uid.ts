export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}
