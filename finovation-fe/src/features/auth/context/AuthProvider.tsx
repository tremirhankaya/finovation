import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

import { getCurrentUser, login, logout } from "@/features/auth/api/authService"
import { AuthContext } from "@/features/auth/context/AuthContext"
import type { LoginCredentials } from "@/features/auth/model/loginSchema"
import type { MeResponse } from "@/features/auth/model/auth.types"
import { ApiRequestError } from "@/shared/api/apiError"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "@/shared/auth/authStorage"
import { onSessionExpired } from "@/shared/auth/sessionEvents"
import { invalidateAuthSession } from "@/shared/api/httpClient"

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initializationError, setInitializationError] = useState("")
  const [sessionExpired, setSessionExpired] = useState(false)
  const operationVersionRef = useRef(0)

  const refreshUser = useCallback(async () => {
    const operationVersion = ++operationVersionRef.current

    if (!getAccessToken()) {
      setUser(null)
      setIsInitializing(false)
      setInitializationError("")
      return
    }

    setIsInitializing(true)
    setInitializationError("")

    try {
      const currentUser = await getCurrentUser()
      if (operationVersion !== operationVersionRef.current) return

      setUser(currentUser)
      setSessionExpired(false)
    } catch (error) {
      if (operationVersion !== operationVersionRef.current) return

      if (error instanceof ApiRequestError && error.status === 401) {
        clearTokens()
        invalidateAuthSession()
      }
      setUser(null)
      setInitializationError(
        error instanceof Error
          ? error.message
          : "Oturum bilgileri yüklenemedi.",
      )
      throw error
    } finally {
      if (operationVersion === operationVersionRef.current) {
        setIsInitializing(false)
      }
    }
  }, [])

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const operationVersion = ++operationVersionRef.current
    setInitializationError("")

    try {
      const tokens = await login(credentials)
      if (operationVersion !== operationVersionRef.current) return null

      saveAccessToken(tokens.accessToken)
      saveRefreshToken(tokens.refreshToken)

      const currentUser = await getCurrentUser()
      if (operationVersion !== operationVersionRef.current) return null

      setUser(currentUser)
      setSessionExpired(false)
      return currentUser
    } catch (error) {
      if (operationVersion === operationVersionRef.current) {
        invalidateAuthSession()
        clearTokens()
        setUser(null)
      }
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken()

    operationVersionRef.current += 1
    invalidateAuthSession()
    clearTokens()
    setUser(null)
    setSessionExpired(false)
    setInitializationError("")

    if (refreshToken) {
      void logout(refreshToken).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    void refreshUser().catch(() => undefined)
  }, [refreshUser])

  useEffect(() => {
    return onSessionExpired(() => {
      operationVersionRef.current += 1
      setSessionExpired(true)
      setUser(null)
      setInitializationError("")
      setIsInitializing(false)
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitializing,
        initializationError,
        sessionExpired,
        signIn,
        refreshUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
