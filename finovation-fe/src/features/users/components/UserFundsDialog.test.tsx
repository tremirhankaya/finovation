import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({ getUserFunds: vi.fn() }))

vi.mock("@/features/users/api/userFundService", () => serviceMocks)

import UserFundsDialog from "@/features/users/components/UserFundsDialog"

const USER = {
  id: 9,
  username: "fon.user",
  firstName: "Fon",
  lastName: "Kullanıcısı",
  fullName: "Fon Kullanıcısı",
  email: "fon@example.com",
  companyId: 3,
  companyName: "Infina",
  role: "USER" as const,
  status: "ACTIVE" as const,
  createdAt: "2026-08-01T10:00:00",
}

describe("UserFundsDialog", () => {
  beforeEach(() => serviceMocks.getUserFunds.mockReset())

  it("kullanıcının tamamlanmış fonlarını dialog içinde gösterir", async () => {
    serviceMocks.getUserFunds.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Atlas Fonu",
        type: "EQUITY_INTENSIVE",
        currency: "TRY",
        inceptionDate: "2026-08-01",
      },
    ])

    render(<UserFundsDialog open user={USER} onClose={vi.fn()} />)

    expect(await screen.findByText("Atlas Fonu")).toBeVisible()
    expect(serviceMocks.getUserFunds).toHaveBeenCalledWith(
      9,
      expect.any(AbortSignal),
    )
  })
})
