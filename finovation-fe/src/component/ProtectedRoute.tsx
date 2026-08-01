import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { useAuth } from "@/context/AuthContext"

type ProtectedRouteProps = {
  children: ReactNode
  requirePanelAccess?: boolean
}

export default function ProtectedRoute({
  children,
  requirePanelAccess = false,
}: ProtectedRouteProps) {
  const { user, isLoading, sessionExpired } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={sessionExpired ? { sessionExpired: true } : undefined}
      />
    )
  }

  if (requirePanelAccess && !user.canAccessPanel) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
