import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useUsersList: vi.fn(),
  useCompanyOptions: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  createCompany: vi.fn(),
  deleteCompany: vi.fn(),
  signOut: vi.fn(),
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
vi.mock("@/features/users/api/companyService", () => ({
  createCompany: mocks.createCompany,
  deleteCompany: mocks.deleteCompany,
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
  role: "COMPANY_MANAGER" as const,
  status: "ACTIVE" as const,
  createdAt: "2026-08-03T00:00:00",
}

function renderUsersPage() {
  return render(
    <MemoryRouter initialEntries={["/users"]}>
      <Routes>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("UsersPage", () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockReset()
    mocks.createUser.mockReset()
    mocks.updateUser.mockReset()
    mocks.deleteUser.mockReset().mockResolvedValue(undefined)
    mocks.createCompany.mockReset().mockResolvedValue({ id: 8, name: "Yeni" })
    mocks.deleteCompany.mockReset().mockResolvedValue(undefined)
    mocks.signOut.mockReset().mockResolvedValue(undefined)
    mocks.useAuth.mockReturnValue({
      user: {
        id: 1,
        role: "ADMIN",
        canCreateUser: true,
        assignableRoles: ["COMPANY_MANAGER", "ADMIN"],
        deletableRoles: ["COMPANY_MANAGER"],
      },
      signOut: mocks.signOut,
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
    renderUsersPage()

    await user.click(screen.getByRole("button", { name: "admin sil" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "admin kullanıcısını silmek istediğinize emin misiniz",
    )

    await user.click(screen.getByRole("button", { name: /^Sil$/ }))

    await waitFor(() => expect(mocks.deleteUser).toHaveBeenCalledWith(2))
    expect(reload).toHaveBeenCalledOnce()
  })

  it("şirket ekler ve şirket silme onayında bağlı kullanıcı uyarısını gösterir", async () => {
    const user = userEvent.setup()
    renderUsersPage()

    const userTable = screen.getByRole("table")
    const companyHeading = screen.getByRole("heading", { name: "Şirketler" })
    expect(
      userTable.compareDocumentPosition(companyHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "+ Yeni şirket" }))
    const createDialog = screen.getByRole("dialog")
    expect(createDialog).toHaveTextContent("Yeni şirket")
    await user.type(
      within(createDialog).getByRole("textbox", { name: /Şirket adı/ }),
      "Yeni Şirket",
    )
    await user.click(screen.getByRole("button", { name: "Şirketi ekle" }))

    await waitFor(() =>
      expect(mocks.createCompany).toHaveBeenCalledWith({ name: "Yeni Şirket" }),
    )

    await user.click(
      screen.getByRole("button", { name: "Infina şirketini sil" }),
    )
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "bu şirkete bağlı tüm kullanıcılar silinecek",
    )
  })

  it("super admin için çıkış aksiyonunu korur", async () => {
    const user = userEvent.setup()
    renderUsersPage()

    await user.click(screen.getByRole("button", { name: "Çıkış yap" }))

    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it("şirketleri ada göre arar ve sayfada en fazla on kayıt gösterir", async () => {
    const user = userEvent.setup()
    mocks.useCompanyOptions.mockReturnValue({
      companies: Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        name: `Şirket ${String(index + 1).padStart(2, "0")}`,
      })),
      error: "",
      isLoading: false,
      reload: vi.fn(),
    })
    renderUsersPage()

    const section = screen
      .getByRole("heading", { name: "Şirketler" })
      .closest("section")
    expect(section).not.toBeNull()
    const companyCard = within(section as HTMLElement)

    expect(companyCard.getAllByRole("listitem")).toHaveLength(10)
    expect(companyCard.getByText("Sayfa 1 / 2")).toBeVisible()
    expect(companyCard.queryByText("Şirket 11")).toBeNull()

    await user.click(companyCard.getByRole("button", { name: "Sonraki" }))
    expect(companyCard.getAllByRole("listitem")).toHaveLength(2)
    expect(companyCard.getByText("Şirket 11")).toBeVisible()

    await user.type(
      companyCard.getByRole("searchbox", { name: "Şirket adına göre ara" }),
      "Şirket 02",
    )
    expect(companyCard.getAllByRole("listitem")).toHaveLength(1)
    expect(companyCard.getByText("Şirket 02")).toBeVisible()
    expect(companyCard.getByText("Sayfa 1 / 1")).toBeVisible()
  })

  it("admin için şirket yönetimini gizleyip ana sayfaya döner", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: 3,
        role: "COMPANY_MANAGER",
        canCreateUser: true,
        assignableRoles: ["USER"],
        deletableRoles: ["USER"],
      },
      signOut: mocks.signOut,
    })

    const user = userEvent.setup()
    renderUsersPage()

    expect(screen.getByRole("heading", { name: "Kullanıcılar" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "Şirketler" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "+ Yeni kullanıcı" }),
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Ana sayfaya dön" }))

    expect(await screen.findByText("Dashboard")).toBeVisible()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})
