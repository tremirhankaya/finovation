import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getFundDraftLimits: vi.fn(),
  createFundDraft: vi.fn(),
}))

vi.mock("@/features/fund-design/api/fundDraftApi", () => mocks)

import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import { toApiRequestError } from "@/shared/api/apiError"

const LIMITS = {
  minInitialPortfolioSize: 1_000_000,
  maxInitialPortfolioSize: 100_000_000_000,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/fund-design"]}>
      <Routes>
        <Route path="/fund-design" element={<StartFundDraftPage />} />
        <Route
          path="/fund-design/:draftId/strategy"
          element={<div>Strateji adımı</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("StartFundDraftPage", () => {
  beforeEach(() => {
    mocks.getFundDraftLimits.mockReset().mockResolvedValue(LIMITS)
    mocks.createFundDraft.mockReset()
  })

  it("limit gelmeden devam butonunu kapalı tutar", () => {
    mocks.getFundDraftLimits.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole("button", { name: "Devam Et →" })).toBeDisabled()
    expect(mocks.createFundDraft).not.toHaveBeenCalled()
  })

  it("geçerli tutarda taslak oluşturup strateji adımına geçer", async () => {
    mocks.createFundDraft.mockResolvedValue({
      draftId: "11111111-1111-1111-1111-111111111111",
    })
    const user = userEvent.setup()
    renderPage()

    await screen.findByLabelText(/İzin verilen aralık/)
    await user.type(
      screen.getByLabelText("Başlangıç Portföy Büyüklüğü *"),
      "5000000",
    )
    await user.click(screen.getByRole("button", { name: "Devam Et →" }))

    await waitFor(() => {
      expect(mocks.createFundDraft).toHaveBeenCalledWith(5_000_000)
    })
    expect(await screen.findByText("Strateji adımı")).toBeInTheDocument()
  })

  it("FUND_001 gelince teknik metni göstermez", async () => {
    mocks.createFundDraft.mockRejectedValue(
      toApiRequestError(
        {
          code: "FUND_001",
          message: "The initial portfolio size is outside the allowed range.",
        },
        400,
        "Fon taslağı oluşturulamadı",
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByLabelText(/İzin verilen aralık/)
    await user.type(
      screen.getByLabelText("Başlangıç Portföy Büyüklüğü *"),
      "5000000",
    )
    await user.click(screen.getByRole("button", { name: "Devam Et →" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Başlangıç portföy büyüklüğü izin verilen aralığın dışında.",
    )
    expect(alert).not.toHaveTextContent("outside the allowed range")
  })

  it("limit alınamazsa tekrar denemeye izin verir", async () => {
    mocks.getFundDraftLimits.mockRejectedValueOnce(
      new Error("Portföy limiti alınamadı."),
    )
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Portföy limiti alınamadı.",
    )
    expect(
      screen.getByRole("button", { name: "Tekrar dene" }),
    ).toBeInTheDocument()
  })
})
