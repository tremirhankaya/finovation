import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authServiceMocks = vi.hoisted(() => ({
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}))

vi.mock("@/features/auth/api/authService", () => authServiceMocks)

import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import { toApiRequestError } from "@/shared/api/apiError"

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/users" element={<div>Sistem Yönetimi</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  beforeEach(() => {
    sessionStorage.clear()
    authServiceMocks.login.mockReset()
    authServiceMocks.getCurrentUser.mockReset()
    authServiceMocks.logout.mockReset()
  })

  it("yanlış girişte AUTH_001 mesajını form üzerinde tutar", async () => {
    let rejectLogin: ((reason: unknown) => void) | undefined
    authServiceMocks.login.mockReturnValue(
      new Promise((_, reject) => {
        rejectLogin = reject
      }),
    )
    const user = userEvent.setup()

    renderLoginPage()

    await user.type(
      await screen.findByLabelText("Kullanıcı Adı"),
      "yanlis-kullanici",
    )
    await user.type(screen.getByLabelText("Şifre"), "yanlis-sifre")
    await user.click(screen.getByRole("button", { name: "Giriş yap" }))

    expect(
      await screen.findByRole("button", { name: "Giriş yapılıyor…" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Kullanıcı Adı")).toHaveValue(
      "yanlis-kullanici",
    )

    await act(async () => {
      rejectLogin?.(
        toApiRequestError(
          { code: "AUTH_001", message: "Invalid username or password." },
          401,
          "Giriş başarısız oldu",
        ),
      )
    })

    const alert = await screen.findByText("Kullanıcı adı veya şifre hatalı.")
    expect(alert).toHaveAttribute("role", "alert")
    expect(screen.getByLabelText("Kullanıcı Adı")).toHaveValue(
      "yanlis-kullanici",
    )
  })

  it("boş alanlarda API isteği göndermeden alan hatalarını gösterir", async () => {
    renderLoginPage()

    await userEvent.click(
      await screen.findByRole("button", { name: "Giriş yap" }),
    )

    expect(screen.getByText("Kullanıcı adı zorunludur.")).toBeInTheDocument()
    expect(screen.getByText("Şifre zorunludur.")).toBeInTheDocument()
    expect(authServiceMocks.login).not.toHaveBeenCalled()
  })

  it("super admini girişten sonra doğrudan sistem yönetimine gönderir", async () => {
    authServiceMocks.login.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    })
    authServiceMocks.getCurrentUser.mockResolvedValue({
      id: 1,
      username: "superadmin",
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@example.com",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      passwordChangeRequired: false,
      companyId: null,
      companyName: null,
      canAccessPanel: true,
      canCreateUser: true,
      canDeleteUser: true,
      assignableRoles: ["ADMIN", "SUPER_ADMIN"],
      deletableRoles: ["ADMIN"],
    })
    const user = userEvent.setup()

    renderLoginPage()
    await user.type(await screen.findByLabelText("Kullanıcı Adı"), "superadmin")
    await user.type(screen.getByLabelText("Şifre"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Giriş yap" }))

    expect(await screen.findByText("Sistem Yönetimi")).toBeInTheDocument()
  })
})
