import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: useAuthMock,
}))

import GuestRoute from "@/app/router/GuestRoute"
import ProtectedRoute from "@/app/router/ProtectedRoute"
import type { AuthContextValue } from "@/features/auth/context/AuthContext"

const COMPANY_MANAGER = {
  id: 1,
  username: "batuhan",
  firstName: "Batuhan",
  lastName: "Pınar",
  email: "batuhan@example.com",
  role: "COMPANY_MANAGER" as const,
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

const ADMIN = {
  ...COMPANY_MANAGER,
  id: 2,
  role: "ADMIN" as const,
  companyId: null,
  companyName: null,
  canAccessPanel: true,
  canCreateUser: true,
  canDeleteUser: true,
  assignableRoles: ["COMPANY_MANAGER" as const, "ADMIN" as const],
  deletableRoles: ["COMPANY_MANAGER" as const],
}

const USER = {
  ...COMPANY_MANAGER,
  id: 3,
  role: "USER" as const,
  canAccessPanel: false,
  canCreateUser: false,
  canDeleteUser: false,
  assignableRoles: [],
  deletableRoles: [],
}

function authValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: null,
    isInitializing: false,
    initializationError: "",
    sessionExpired: false,
    signIn: vi.fn(),
    refreshUser: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div>{location.pathname}</div>
}

describe("route guards", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it("başlangıç oturumu doğrulanırken guest ekranını göstermez", () => {
    useAuthMock.mockReturnValue(authValue({ isInitializing: true }))

    const { container } = render(
      <MemoryRouter>
        <GuestRoute>
          <div>Login</div>
        </GuestRoute>
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("giriş yapmış kullanıcıyı guest route'tan dashboard'a gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: COMPANY_MANAGER }))

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <div>Login</div>
              </GuestRoute>
            }
          />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/dashboard")).toBeInTheDocument()
  })

  it("giriş yapmış super admini guest route'tan kullanıcı yönetimine gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: ADMIN }))

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <div>Login</div>
              </GuestRoute>
            }
          />
          <Route path="/users" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/users")).toBeInTheDocument()
  })

  it("oturumsuz kullanıcıyı korumalı route'tan login'e gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ sessionExpired: true }))

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <div>Kullanıcılar</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/login")).toBeInTheDocument()
  })

  it("panel yetkisi olmayan kullanıcıyı dashboard'a gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: USER }))

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route
            path="/users"
            element={
              <ProtectedRoute requirePanelAccess>
                <div>Kullanıcılar</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/dashboard")).toBeInTheDocument()
  })

  it("adminin kullanıcı yönetimi route'una erişmesine izin verir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: COMPANY_MANAGER }))

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <ProtectedRoute requirePanelAccess>
          <div>Kullanıcı Yönetimi</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(await screen.findByText("Kullanıcı Yönetimi")).toBeInTheDocument()
  })

  it("super adminin ürün route'larına erişimini kullanıcı yönetimine yönlendirir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: ADMIN }))

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireProductAccess>
                <div>Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/users" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/users")).toBeInTheDocument()
  })

  it("company managerı yalnız admine açık sistem route'undan ana sayfaya yönlendirir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: COMPANY_MANAGER }))

    render(
      <MemoryRouter initialEntries={["/system-logs"]}>
        <Routes>
          <Route
            path="/system-logs"
            element={
              <ProtectedRoute requireAdmin>
                <div>Log İzleme</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/dashboard")).toBeInTheDocument()
  })

  it("zorunlu parola değişikliği olan kullanıcıyı modül yerine güvenlik route'una gönderir", async () => {
    useAuthMock.mockReturnValue(
      authValue({
        user: { ...USER, passwordChangeRequired: true },
      }),
    )

    render(
      <MemoryRouter initialEntries={["/fund-monitoring"]}>
        <Routes>
          <Route
            path="/fund-monitoring"
            element={
              <ProtectedRoute requireProductAccess>
                <div>Fon İzleme</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/password-required"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByText("/account/password-required"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Fon İzleme")).not.toBeInTheDocument()
  })

  it("admini passwordChangeRequired true olsa bile güvenlik route'una göndermez", () => {
    useAuthMock.mockReturnValue(
      authValue({
        user: { ...ADMIN, passwordChangeRequired: true },
      }),
    )

    render(
      <MemoryRouter>
        <ProtectedRoute requirePanelAccess>
          <div>Kullanıcı Yönetimi</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByText("Kullanıcı Yönetimi")).toBeInTheDocument()
  })

  it("zorunluluğu olmayan kullanıcıyı parola route'undan ana sayfasına gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: USER }))

    render(
      <MemoryRouter initialEntries={["/account/password-required"]}>
        <Routes>
          <Route
            path="/account/password-required"
            element={
              <ProtectedRoute allowPasswordChangeRequired>
                <div>Parola Ekranı</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/dashboard")).toBeInTheDocument()
  })
})
