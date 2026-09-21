import { getInitials } from '../lib/initials'

interface Props {
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

export function Avatar({ name, avatarUrl, size = 32, className = '' }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Foto de perfil'}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--blue)] font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {getInitials(name)}
    </span>
  )
}
