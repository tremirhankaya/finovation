import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiSend: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  getCurrentUser,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from "@/features/auth/api/authService"

describe("authService", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset().mockResolvedValue({})
    httpMocks.apiSend.mockReset().mockResolvedValue(undefined)
  })

  it("login ve /me isteklerini doğru auth ayarlarıyla gönderir", async () => {
    await login({ username: "batuhan", password: "Valid1!" })
    await getCurrentUser()

    expect(httpMocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        requiresAuth: false,
        body: { username: "batuhan", password: "Valid1!" },
      }),
      expect.any(Function),
    )
    expect(httpMocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/me",
      expect.objectContaining({ errorMessage: "Kullanıcı bilgisi alınamadı" }),
      expect.any(Function),
    )
  })

  it("logout ve şifre yenileme payloadlarını doğru endpointlere taşır", async () => {
    await logout("refresh-token")
    await requestPasswordReset("batuhan@example.com")
    await verifyPasswordResetCode("batuhan@example.com", "123456")
    await resetPassword("reset-token", "Valid1!", "Valid1!")

    expect(httpMocks.apiSend).toHaveBeenNthCalledWith(
      1,
      "/api/v1/auth/logout",
      expect.objectContaining({
        requiresAuth: false,
        body: { refreshToken: "refresh-token" },
      }),
    )
    expect(httpMocks.apiSend).toHaveBeenNthCalledWith(
      2,
      "/api/v1/auth/password-reset/request",
      expect.objectContaining({ body: { email: "batuhan@example.com" } }),
    )
    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/auth/password-reset/verify",
      expect.objectContaining({
        body: { email: "batuhan@example.com", code: "123456" },
      }),
      expect.any(Function),
    )
    expect(httpMocks.apiSend).toHaveBeenNthCalledWith(
      3,
      "/api/v1/auth/password-reset/reset",
      expect.objectContaining({
        body: {
          resetToken: "reset-token",
          newPassword: "Valid1!",
          newPasswordConfirm: "Valid1!",
        },
      }),
    )
  })
})
