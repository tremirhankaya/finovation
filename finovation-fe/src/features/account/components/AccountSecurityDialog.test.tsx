import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const changePasswordMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/account/api/accountService", () => ({
  changePassword: changePasswordMock,
}))

import AccountSecurityDialog from "@/features/account/components/AccountSecurityDialog"

const ACCOUNT_USER = {
  id: 4,
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

describe("AccountSecurityDialog", () => {
  beforeEach(() => {
    changePasswordMock.mockReset().mockResolvedValue(undefined)
  })

  it("hesap bilgilerini salt okunur değerler olarak gösterir", () => {
    render(
      <AccountSecurityDialog
        open
        user={ACCOUNT_USER}
        roleLabel="Company Manager"
        onClose={vi.fn()}
        onPasswordChanged={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("dialog", { name: "Hesap ve Güvenlik" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Batuhan")).toBeInTheDocument()
    expect(screen.getByText("Pınar")).toBeInTheDocument()
    expect(screen.getByText("batuhan@example.com")).toBeInTheDocument()
    expect(screen.getByText("Company Manager")).toBeInTheDocument()
    expect(screen.getByText("Infina")).toBeInTheDocument()
    expect(screen.queryByLabelText("Yeni parola *")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Parolayı değiştir" }),
    ).toBeInTheDocument()
  })

  it("parola formunu yalnız aksiyon seçilince açar ve geri ile kapatır", async () => {
    const user = userEvent.setup()
    render(
      <AccountSecurityDialog
        open
        user={ACCOUNT_USER}
        roleLabel="Company Manager"
        onClose={vi.fn()}
        onPasswordChanged={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))
    expect(screen.getByLabelText("Yeni parola *")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Geri" }))
    expect(screen.queryByLabelText("Yeni parola *")).not.toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it("eşleşmeyen parolaları API isteği göndermeden reddeder", async () => {
    const user = userEvent.setup()
    render(
      <AccountSecurityDialog
        open
        user={ACCOUNT_USER}
        roleLabel="Company Manager"
        onClose={vi.fn()}
        onPasswordChanged={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))
    await user.type(screen.getByLabelText("Yeni parola *"), "NewPassword1!")
    await user.type(screen.getByLabelText("Parola tekrar *"), "Different1!")
    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))

    expect(screen.getByText("Parolalar eşleşmiyor.")).toBeInTheDocument()
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it("geçerli parola çiftini gönderip başarı callbackini çağırır", async () => {
    const user = userEvent.setup()
    const onPasswordChanged = vi.fn()
    render(
      <AccountSecurityDialog
        open
        user={ACCOUNT_USER}
        roleLabel="Company Manager"
        onClose={vi.fn()}
        onPasswordChanged={onPasswordChanged}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))
    await user.type(screen.getByLabelText("Yeni parola *"), "NewPassword1!")
    await user.type(screen.getByLabelText("Parola tekrar *"), "NewPassword1!")
    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))

    expect(changePasswordMock).toHaveBeenCalledWith({
      newPassword: "NewPassword1!",
      newPasswordConfirm: "NewPassword1!",
    })
    expect(onPasswordChanged).toHaveBeenCalledOnce()
  })

  it("API hatasını dialog içinde gösterir", async () => {
    changePasswordMock.mockRejectedValue(new Error("Parola değiştirilemedi."))
    const user = userEvent.setup()
    render(
      <AccountSecurityDialog
        open
        user={ACCOUNT_USER}
        roleLabel="Company Manager"
        onClose={vi.fn()}
        onPasswordChanged={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))
    await user.type(screen.getByLabelText("Yeni parola *"), "NewPassword1!")
    await user.type(screen.getByLabelText("Parola tekrar *"), "NewPassword1!")
    await user.click(screen.getByRole("button", { name: "Parolayı değiştir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Parola değiştirilemedi.",
    )
  })
})
