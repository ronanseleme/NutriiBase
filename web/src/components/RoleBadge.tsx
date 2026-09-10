import type { AccessRole } from '../types'

const ROLE_STYLE: Record<AccessRole, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'var(--coral)' },
  pro: { label: 'Pro', color: 'var(--blue)' },
  free: { label: 'Free', color: 'var(--text-soft)' },
}

export function RoleBadge({ role }: { role: AccessRole }) {
  const { label, color } = ROLE_STYLE[role]
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
