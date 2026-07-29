const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = configuredApiUrl?.replace(/\/$/, "") ?? ""
export const LOGIN_PATH =
  import.meta.env.VITE_LOGIN_PATH?.trim() || "/api/auth/login"

export function getLoginUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      "Backend adresi henüz yapılandırılmadı. .env dosyasında VITE_API_BASE_URL değerini tanımlayın.",
    )
  }

  return `${API_BASE_URL}${
    LOGIN_PATH.startsWith("/") ? LOGIN_PATH : `/${LOGIN_PATH}`
  }`
}
