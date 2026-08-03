import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import UserCreateModal from "@/features/users/components/UserCreateModal"

const BASE_PROPS = {
  open: true,
  companies: [],
  companiesLoading: false,
  companiesError: "",
  actorRole: "SUPER_ADMIN" as const,
  onClose: vi.fn(),
  onErrorDismiss: vi.fn(),
  onRetryCompanies: vi.fn(),
}

describe("UserCreateModal", () => {
  it("parolayı baş ve son boşluklarını değiştirmeden API payloadına taşır", async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(
      <UserCreateModal
        {...BASE_PROPS}
        assignableRoles={["SUPER_ADMIN"]}
        onCreate={onCreate}
      />,
    )

    await user.type(screen.getByLabelText(/Kullanıcı adı/), "batuhan")
    await user.type(screen.getByLabelText(/^Ad/), "Batuhan")
    await user.type(screen.getByLabelText(/Soyad/), "Pınar")
    await user.type(screen.getByLabelText(/E-posta/), "batuhan@example.com")
    await user.type(screen.getByLabelText(/^Parola \*/i), " Valid1! ")
    await user.type(screen.getByLabelText(/Parola tekrar/), " Valid1! ")
    await user.click(screen.getByRole("button", { name: "Oluştur" }))

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ password: " Valid1! " }),
    )
  })

  it("şirketler yüklenirken şirket zorunlu kullanıcı oluşturmayı engeller", () => {
    render(
      <UserCreateModal
        {...BASE_PROPS}
        assignableRoles={["ADMIN"]}
        companiesLoading
        onCreate={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "Oluştur" })).toBeDisabled()
    expect(
      screen.getByRole("option", { name: "Şirketler yükleniyor…" }),
    ).toBeInTheDocument()
  })
})
