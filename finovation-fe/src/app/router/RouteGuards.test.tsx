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

const ADMIN = {
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

const SUPER_ADMIN = {
  ...ADMIN,
  id: 2,
  role: "SUPER_ADMIN" as const,
  companyId: null,
  companyName: null,
  canAccessPanel: true,
  canCreateUser: true,
  canDeleteUser: true,
  assignableRoles: ["ADMIN" as const, "SUPER_ADMIN" as const],
  deletableRoles: ["ADMIN" as const],
}

const USER = {
  ...ADMIN,
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
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText("/dashboard")).toBeInTheDocument()
  })

  it("giriş yapmış super admini guest route'tan kullanıcı yönetimine gönderir", async () => {
    useAuthMock.mockReturnValue(authValue({ user: SUPER_ADMIN }))

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
    useAuthMock.mockReturnValue(authValue({ user: ADMIN }))

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
    useAuthMock.mockReturnValue(authValue({ user: SUPER_ADMIN }))

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
})
