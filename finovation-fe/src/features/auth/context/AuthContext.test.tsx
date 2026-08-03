import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authServiceMocks = vi.hoisted(() => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}))

const invalidateAuthSession = vi.hoisted(() => vi.fn())

vi.mock("@/features/auth/api/authService", () => authServiceMocks)
vi.mock("@/shared/api/httpClient", () => ({ invalidateAuthSession }))

import { useAuth } from "@/features/auth/context/AuthContext"
import AuthProvider from "@/features/auth/context/AuthProvider"

const CURRENT_USER = {
  id: 1,
  username: "batuhan",
  firstName: "Batuhan",
  lastName: "Pınar",
  email: "batuhan@example.com",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  passwordChangeRequired: false,
  companyId: 2,
  companyName: "Infina",
  canAccessPanel: true,
  canCreateUser: true,
  canDeleteUser: true,
  assignableRoles: ["USER" as const],
  deletableRoles: ["USER" as const],
}

function AuthProbe() {
  const { user, isInitializing, signIn } = useAuth()
  const [error, setError] = useState("")

  return (
    <div>
      <span>
        {isInitializing ? "yükleniyor" : (user?.username ?? "misafir")}
      </span>
      <span>{error}</span>
      <button
        type="button"
        onClick={() =>
          void signIn({ username: "batuhan", password: "Valid1!" }).catch(
            (reason: unknown) =>
              setError(reason instanceof Error ? reason.message : "hata"),
          )
        }
      >
        Giriş yap
      </button>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    sessionStorage.clear()
    authServiceMocks.login.mockReset()
    authServiceMocks.getCurrentUser.mockReset()
    authServiceMocks.logout.mockReset()
    invalidateAuthSession.mockReset()
  })

  it("login ve /me başarılıysa kullanıcı oturumunu birlikte kurar", async () => {
    authServiceMocks.login.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    })
    authServiceMocks.getCurrentUser.mockResolvedValue(CURRENT_USER)

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Giriş yap" }),
    )

    expect(await screen.findByText("batuhan")).toBeInTheDocument()
    expect(sessionStorage.getItem("accessToken")).toBe("access")
    expect(sessionStorage.getItem("refreshToken")).toBe("refresh")
  })

  it("login sonrası /me başarısızsa yarım oturumu temizler", async () => {
    authServiceMocks.login.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    })
    authServiceMocks.getCurrentUser.mockRejectedValue(
      new Error("Profil yüklenemedi"),
    )

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Giriş yap" }),
    )

    expect(await screen.findByText("Profil yüklenemedi")).toBeInTheDocument()
    await waitFor(() => {
      expect(sessionStorage.getItem("accessToken")).toBeNull()
      expect(sessionStorage.getItem("refreshToken")).toBeNull()
    })
    expect(invalidateAuthSession).toHaveBeenCalledOnce()
  })
})
