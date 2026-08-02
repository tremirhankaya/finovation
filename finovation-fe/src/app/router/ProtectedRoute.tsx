import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { useAuth } from "@/features/auth/context/AuthContext"
import RouteStatus from "@/app/router/RouteStatus"

type ProtectedRouteProps = {
  children: ReactNode
  requirePanelAccess?: boolean
}

export default function ProtectedRoute({
  children,
  requirePanelAccess = false,
}: ProtectedRouteProps) {
  const {
    user,
    isInitializing,
    initializationError,
    sessionExpired,
    refreshUser,
  } = useAuth()

  if (isInitializing) {
    return null
  }

  if (initializationError) {
    return (
      <RouteStatus
        mode="error"
        message={initializationError}
        onRetry={() => void refreshUser().catch(() => undefined)}
      />
    )
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
