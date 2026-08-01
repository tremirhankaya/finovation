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
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requirePanelAccess && !user.canAccessPanel) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
