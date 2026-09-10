import type { AccessRole } from '../types'

interface Props {
  role: AccessRole
  allowedRoles: AccessRole[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function ProtectedRoute({ role, allowedRoles, fallback = null, children }: Props) {
  if (!allowedRoles.includes(role)) return <>{fallback}</>
  return <>{children}</>
}
