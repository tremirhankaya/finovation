import {
  getLoginUrl,
  getLogoutUrl,
  getMeUrl,
  getPasswordResetRequestUrl,
  getPasswordResetUrl,
  getPasswordResetVerifyUrl,
} from "@/config/api"
import { apiFetch, apiSend } from "@/service/httpClient"
import type { LoginCredentials } from "@/schema/authSchema"
import type {
  LoginResponse,
  MeResponse,
  PasswordResetVerifyResponse,
} from "@/type/auth.types"

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

export async function requestPasswordReset(
  email: string,
): Promise<void> {
  return apiSend(getPasswordResetRequestUrl(), {
    method: "POST",
    body: { email },
    requiresAuth: false,
    errorMessage: "Doğrulama kodu gönderilemedi",
  })
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<PasswordResetVerifyResponse> {
  return apiFetch<PasswordResetVerifyResponse>(getPasswordResetVerifyUrl(), {
    method: "POST",
    body: { email, code },
    requiresAuth: false,
    errorMessage: "Doğrulama kodu kontrol edilemedi",
  })
}

export async function resetPassword(
  resetToken: string,
  newPassword: string,
  newPasswordConfirm: string,
): Promise<void> {
  return apiSend(getPasswordResetUrl(), {
    method: "POST",
    body: { resetToken, newPassword, newPasswordConfirm },
    requiresAuth: false,
    errorMessage: "Şifre güncellenemedi",
  })
}
