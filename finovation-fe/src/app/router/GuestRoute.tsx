import type { ReactNode } from "react"
import { Navigate } from "react-router"

import RouteStatus from "@/app/router/RouteStatus"
import { useAuth } from "@/features/auth/context/AuthContext"

export default function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isInitializing, initializationError, refreshUser } = useAuth()

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

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
