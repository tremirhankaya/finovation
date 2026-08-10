import type { ReactNode } from "react"
import { Navigate } from "react-router"

import { useAuth } from "@/features/auth/context/AuthContext"
import RouteStatus from "@/app/router/RouteStatus"
import { getAuthenticatedHomePath } from "@/app/router/routeAccess"

type ProtectedRouteProps = {
  children: ReactNode
  requirePanelAccess?: boolean
  requireProductAccess?: boolean
  requireAdmin?: boolean
  allowPasswordChangeRequired?: boolean
}

export default function ProtectedRoute({
  children,
  requirePanelAccess = false,
  requireProductAccess = false,
  requireAdmin = false,
  allowPasswordChangeRequired = false,
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

  const homePath = getAuthenticatedHomePath(user)
  const passwordChangeRequired = homePath === "/account/password-required"

  if (passwordChangeRequired && !allowPasswordChangeRequired) {
    return <Navigate to="/account/password-required" replace />
  }

  if (!passwordChangeRequired && allowPasswordChangeRequired) {
    return <Navigate to={homePath} replace />
  }

  if (requirePanelAccess && !user.canAccessPanel) {
    return <Navigate to={homePath} replace />
  }

  if (requireProductAccess && user.role === "ADMIN") {
    return <Navigate to={homePath} replace />
  }

  if (requireAdmin && user.role !== "ADMIN") {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}
