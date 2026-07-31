const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL =
    configuredApiUrl?.replace(/\/$/, "") || "/api"

export const LOGIN_PATH =
    import.meta.env.VITE_LOGIN_PATH?.trim() || "/v1/auth/login"

export function getLoginUrl(): string {
  const normalizedLoginPath = LOGIN_PATH.startsWith("/")
      ? LOGIN_PATH
      : `/${LOGIN_PATH}`

  return `${API_BASE_URL}${normalizedLoginPath}`
}