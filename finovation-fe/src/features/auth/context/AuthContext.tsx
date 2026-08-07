import { createContext, useContext } from "react"

import type { LoginCredentials } from "@/features/auth/model/loginSchema"
import type { MeResponse } from "@/features/auth/model/auth.types"

export type AuthContextValue = {
  user: MeResponse | null
  isInitializing: boolean
  initializationError: string
  sessionExpired: boolean
  signIn: (credentials: LoginCredentials) => Promise<MeResponse | null>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
