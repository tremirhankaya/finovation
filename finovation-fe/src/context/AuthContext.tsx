import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

import { getCurrentUser, logout } from "@/service/authService"
import type { MeResponse } from "@/type/auth.types"
import { ApiRequestError } from "@/util/apiError"
import { clearTokens, getAccessToken, getRefreshToken } from "@/util/authStorage"

type AuthContextValue = {
  user: MeResponse | null
  isLoading: boolean
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      setUser(await getCurrentUser())
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        clearTokens()
        setUser(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken()

    if (refreshToken) {
      await logout(refreshToken).catch(() => undefined)
    }

    clearTokens()
    setUser(null)
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
