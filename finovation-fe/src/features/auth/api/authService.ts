import {
  getLoginUrl,
  getLogoutUrl,
  getMeUrl,
  getPasswordResetRequestUrl,
  getPasswordResetUrl,
  getPasswordResetVerifyUrl,
} from "@/shared/api/apiConfig"
import { apiFetch, apiSend } from "@/shared/api/httpClient"
import type { LoginCredentials } from "@/features/auth/model/loginSchema"
import type {
  LoginResponse,
  MeResponse,
  PasswordResetVerifyResponse,
} from "@/features/auth/model/auth.types"
import {
  loginResponseSchema,
  meResponseSchema,
  passwordResetVerifyResponseSchema,
} from "@/features/auth/model/authSchemas"

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(
    getLoginUrl(),
    {
      method: "POST",
      body: credentials,
      requiresAuth: false,
      errorMessage: "Giriş başarısız oldu",
    },
    loginResponseSchema.parse,
  )
}

export async function getCurrentUser(): Promise<MeResponse> {
  return apiFetch<MeResponse>(
    getMeUrl(),
    { errorMessage: "Kullanıcı bilgisi alınamadı" },
    meResponseSchema.parse,
  )
}

export async function logout(refreshToken: string): Promise<void> {
  return apiSend(getLogoutUrl(), {
    method: "POST",
    body: { refreshToken },
    requiresAuth: false,
    errorMessage: "Çıkış yapılamadı",
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
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
  return apiFetch<PasswordResetVerifyResponse>(
    getPasswordResetVerifyUrl(),
    {
      method: "POST",
      body: { email, code },
      requiresAuth: false,
      errorMessage: "Doğrulama kodu kontrol edilemedi",
    },
    passwordResetVerifyResponseSchema.parse,
  )
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
