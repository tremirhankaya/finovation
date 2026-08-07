import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { useAuth } from "@/features/auth/context/AuthContext"
import RouteStatus from "@/app/router/RouteStatus"
import { getAuthenticatedHomePath } from "@/app/router/routeAccess"

type ProtectedRouteProps = {
  children: ReactNode
  requirePanelAccess?: boolean
  requireProductAccess?: boolean
}

export default function ProtectedRoute({
  children,
  requirePanelAccess = false,
  requireProductAccess = false,
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
    return <Navigate to={getAuthenticatedHomePath(user)} replace />
  }

  if (requireProductAccess && user.role === "ADMIN") {
    return <Navigate to={getAuthenticatedHomePath(user)} replace />
  }

  return <>{children}</>
}
