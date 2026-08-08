import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: useAuthMock,
}))

import PasswordChangeRequiredPage from "@/features/account/pages/PasswordChangeRequiredPage"

const REQUIRED_USER = {
  id: 4,
  username: "first.login",
  firstName: "İlk",
  lastName: "Giriş",
  email: "first.login@example.com",
  role: "USER" as const,
  status: "ACTIVE" as const,
  passwordChangeRequired: true,
  companyId: 2,
  companyName: "Infina",
  canAccessPanel: false,
  canCreateUser: false,
  canDeleteUser: false,
  assignableRoles: [],
  deletableRoles: [],
}

describe("PasswordChangeRequiredPage", () => {
  const signOut = vi.fn()

  beforeEach(() => {
    signOut.mockReset().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({ user: REQUIRED_USER, signOut })
  })

  it("ilk açılışta açıklama dialogunu ve kilitli modül durumunu gösterir", () => {
    render(
      <MemoryRouter>
        <PasswordChangeRequiredPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole("alertdialog", { name: "Parola değişikliği gerekiyor" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Fon İzleme ve Performans")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "İlk Giriş hesap ve güvenlik",
      }),
    ).toBeInTheDocument()
  })

  it("hesap kartından parola dialogunu form açık şekilde gösterir", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <PasswordChangeRequiredPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Daha sonra" }))
    await user.click(
      screen.getByRole("button", {
        name: "İlk Giriş hesap ve güvenlik",
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Hesap ve Güvenlik" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Yeni parola *")).toBeInTheDocument()
  })
})
