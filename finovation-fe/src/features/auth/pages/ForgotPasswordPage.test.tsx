import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authServiceMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock("@/features/auth/api/authService", () => authServiceMocks)

import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import { toApiRequestError } from "@/shared/api/apiError"

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    authServiceMocks.requestPasswordReset.mockReset()
    authServiceMocks.verifyPasswordResetCode.mockReset()
    authServiceMocks.resetPassword.mockReset()
  })

  it("hesap bulunamadığında AUTH_006 mesajını gösterir", async () => {
    authServiceMocks.requestPasswordReset.mockRejectedValue(
      toApiRequestError(
        { code: "AUTH_006", message: "No account was found." },
        404,
        "Doğrulama kodu gönderilemedi",
      ),
    )
    const user = userEvent.setup()

    renderPage()

    await user.type(screen.getByLabelText("E-posta adresi"), "yok@example.com")
    await user.click(
      screen.getByRole("button", { name: "Doğrulama kodu gönder" }),
    )

    expect(
      await screen.findByText("Bu e-posta adresine ait bir hesap bulunamadı."),
    ).toBeInTheDocument()
  })

  it("OTP adımında hatalı kodu AUTH_007 mesajına çevirir", async () => {
    authServiceMocks.requestPasswordReset.mockResolvedValue(undefined)
    authServiceMocks.verifyPasswordResetCode.mockRejectedValue(
      toApiRequestError(
        { code: "AUTH_007", message: "The verification code is invalid." },
        400,
        "Doğrulama kodu kontrol edilemedi",
      ),
    )
    const user = userEvent.setup()

    renderPage()

    await user.type(
      screen.getByLabelText("E-posta adresi"),
      "batuhan@example.com",
    )
    await user.click(
      screen.getByRole("button", { name: "Doğrulama kodu gönder" }),
    )
    await user.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await user.click(screen.getByRole("button", { name: "Kodu doğrula" }))

    expect(
      await screen.findByText("Girdiğiniz doğrulama kodu hatalı."),
    ).toBeInTheDocument()
  })
})
