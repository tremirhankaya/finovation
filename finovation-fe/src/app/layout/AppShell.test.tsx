import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: useAuthMock,
}))

import AppShell from "@/app/layout/AppShell"

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

const signOutMock = vi.fn()

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderShell(initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<LocationProbe />} />
          <Route path="/fund-design" element={<LocationProbe />} />
          <Route path="/fund-monitoring" element={<LocationProbe />} />
          <Route
            path="/optimization-requests/new"
            element={<LocationProbe />}
          />
          <Route path="/users" element={<LocationProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("AppShell", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    signOutMock.mockReset().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ user: COMPANY_MANAGER, signOut: signOutMock })
  })

  it("ürün menüsünü ve oturumdaki admin bilgisini gösterir", () => {
    renderShell()

    expect(screen.getByRole("link", { name: "Ana Sayfa" })).toHaveAttribute(
      "href",
      "/dashboard",
    )
    expect(screen.getByRole("link", { name: "Fon Tasarımı" })).toHaveAttribute(
      "href",
      "/fund-design",
    )
    expect(
      screen.getByRole("link", { name: "Fon İzleme ve Performans" }),
    ).toHaveAttribute("href", "/fund-monitoring")
    expect(
      screen.getByRole("link", { name: "Fon Optimizasyonu" }),
    ).toHaveAttribute("href", "/optimization-requests/new")
    expect(
      screen.getByRole("link", { name: "Kullanıcı Yönetimi" }),
    ).toHaveAttribute("href", "/users")
    expect(screen.getByText("Batuhan Pınar")).toBeInTheDocument()
    expect(screen.getByText("Company Manager")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Çıkış Yap" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Kâr/Zarar ve Performans"),
    ).not.toBeInTheDocument()
  })

  it("menüyü gizleyip yeniden gösterebilir", async () => {
    const user = userEvent.setup()
    renderShell()

    const hideButton = screen.getByRole("button", { name: "Menüyü gizle" })
    await user.click(hideButton)

    expect(
      screen.getByRole("button", { name: "Menüyü göster" }),
    ).toHaveAttribute("aria-expanded", "false")

    await user.click(screen.getByRole("button", { name: "Menüyü göster" }))
    expect(
      screen.getByRole("button", { name: "Menüyü gizle" }),
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("panel capability'si olmayan kullanıcıya yönetim bağlantısını göstermez", () => {
    useAuthMock.mockReturnValue({
      user: {
        ...COMPANY_MANAGER,
        role: "USER",
        canAccessPanel: false,
      },
      signOut: signOutMock,
    })

    renderShell()

    expect(
      screen.queryByRole("link", { name: "Kullanıcı Yönetimi" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Kullanıcı")).toBeInTheDocument()
  })

  it("çıkış seçeneği oturumu kapatır", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole("button", { name: "Çıkış Yap" }))

    expect(signOutMock).toHaveBeenCalledOnce()
  })

  it("kullanıcı kartından hesap ve güvenlik dialogunu açar", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(
      screen.getByRole("button", {
        name: "Batuhan Pınar hesap ve güvenlik",
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Hesap ve Güvenlik" }),
    ).toBeInTheDocument()
    expect(screen.getByText("batuhan@example.com")).toBeInTheDocument()
  })

  it("menü bağlantısından ilgili ürün route'una geçer", async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(
      screen.getByRole("link", { name: "Fon İzleme ve Performans" }),
    )

    expect(screen.getByTestId("location")).toHaveTextContent("/fund-monitoring")
  })
})
