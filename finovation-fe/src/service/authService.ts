import { getLoginUrl, getLogoutUrl, getMeUrl } from "@/config/api"
import { apiFetch, apiSend } from "@/service/httpClient"
import type { LoginCredentials } from "@/schema/authSchema"
import type { LoginResponse, MeResponse } from "@/type/auth.types"

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(getLoginUrl(), {
    method: "POST",
    body: credentials,
    requiresAuth: false,
    errorMessage: "Giriş başarısız oldu",
  })
}

export async function getCurrentUser(): Promise<MeResponse> {
  return apiFetch<MeResponse>(getMeUrl(), {
    errorMessage: "Kullanıcı bilgisi alınamadı",
  })
}

export async function logout(refreshToken: string): Promise<void> {
  return apiSend(getLogoutUrl(), {
    method: "POST",
    body: { refreshToken },
    requiresAuth: false,
    errorMessage: "Çıkış yapılamadı",
  })
}
