import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useUsersList: vi.fn(),
  useCompanyOptions: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: mocks.useAuth,
}))
vi.mock("@/features/users/hooks/useUsersList", () => ({
  useUsersList: mocks.useUsersList,
}))
vi.mock("@/features/users/hooks/useCompanyOptions", () => ({
  useCompanyOptions: mocks.useCompanyOptions,
}))
vi.mock("@/features/users/api/userService", () => ({
  createUser: mocks.createUser,
  updateUser: mocks.updateUser,
  deleteUser: mocks.deleteUser,
}))

import UsersPage from "@/features/users/pages/UsersPage"

const TARGET_USER = {
  id: 2,
  username: "admin",
  firstName: "Admin",
  lastName: "User",
  fullName: "Admin User",
  email: "admin@example.com",
  companyId: 7,
  companyName: "Infina",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  createdAt: "2026-08-03T00:00:00",
}

describe("UsersPage", () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockReset()
    mocks.createUser.mockReset()
    mocks.updateUser.mockReset()
    mocks.deleteUser.mockReset().mockResolvedValue(undefined)
    mocks.useAuth.mockReturnValue({
      user: {
        id: 1,
        role: "SUPER_ADMIN",
        canCreateUser: true,
        assignableRoles: ["ADMIN", "SUPER_ADMIN"],
        deletableRoles: ["ADMIN"],
      },
    })
    mocks.useCompanyOptions.mockReturnValue({
      companies: [{ id: 7, name: "Infina" }],
      error: "",
      isLoading: false,
      reload: vi.fn(),
    })
    mocks.useUsersList.mockReturnValue({
      users: [TARGET_USER],
      totalPages: 1,
      totalElements: 1,
      hasNext: false,
      hasPrevious: false,
      isLoading: false,
      error: "",
      reload,
    })
  })

  it("silme onayından sonra kullanıcıyı silip listeyi yeniler", async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await user.click(screen.getByRole("button", { name: "admin sil" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "admin kullanıcısını silmek istediğinize emin misiniz",
    )

    await user.click(screen.getByRole("button", { name: /^Sil$/ }))

    await waitFor(() => expect(mocks.deleteUser).toHaveBeenCalledWith(2))
    expect(reload).toHaveBeenCalledOnce()
  })
})
