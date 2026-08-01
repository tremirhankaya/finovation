import { getLoginUrl, getMeUrl } from "@/config/api"
import { apiFetch } from "@/service/httpClient"
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
