import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getFundDraftInit: vi.fn(),
  createFundDraft: vi.fn(),
}))

vi.mock("@/features/fund-design/api/fundDraftApi", () => mocks)

import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import { toApiRequestError } from "@/shared/api/apiError"

const INIT = {
  currencies: [{ code: "TRY", label: "TRY - Türk Lirası" }],
  defaultCurrency: "TRY",
  minInitialPortfolioSize: 1_000_000,
  maxInitialPortfolioSize: 100_000_000_000,
  minUnitPrice: 1,
  maxUnitPrice: 1000,
  minLiquidityTargetPct: 5,
  maxLiquidityTargetPct: 15,
  minTppRangePct: 3,
  minStockCount: 16,
  maxStockCount: 36,
  minStockCountRange: 5,
  minSingleStockMaxPct: 3,
  maxSingleStockMaxPct: 10,
  minEquityWeightPct: 85,
  maxEquityWeightPct: 95,
  sectorMaxPct: 30,
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText("Para Birimi *")
  await user.type(
    screen.getByLabelText("Fon Adı *"),
    "Finovation Hisse Senedi Fonu",
  )
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
    mocks.getFundDraftInit.mockReset().mockResolvedValue(INIT)
    mocks.createFundDraft.mockReset()
  })

  it("init gelmeden ileri butonunu kapalı tutar", () => {
    mocks.getFundDraftInit.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole("button", { name: "İleri →" })).toBeDisabled()
    expect(mocks.createFundDraft).not.toHaveBeenCalled()
  })

  it("geçerli formda taslak oluşturup strateji adımına geçer", async () => {
    mocks.createFundDraft.mockResolvedValue({
      draftId: "11111111-1111-1111-1111-111111111111",
    })
    const user = userEvent.setup()
    renderPage()

    await fillValidForm(user)
    expect(screen.getByLabelText("Para Birimi *")).toHaveValue("TRY")
    await user.click(screen.getByRole("button", { name: "İleri →" }))

    await waitFor(() => {
      expect(mocks.createFundDraft).toHaveBeenCalledWith({
        name: "Finovation Hisse Senedi Fonu",
        initialPortfolioSize: 1_000_000,
        unitPrice: 1,
      })
    })
    expect(await screen.findByText("Strateji adımı")).toBeInTheDocument()
  })

  it("sayı içeren fon adında ileri kapalı kalır", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByLabelText("Para Birimi *")
    await user.type(screen.getByLabelText("Fon Adı *"), "Fon 2")

    expect(screen.getByRole("button", { name: "İleri →" })).toBeDisabled()
    expect(screen.getByText("Fon adında sayı bulunamaz.")).toBeInTheDocument()
    expect(mocks.createFundDraft).not.toHaveBeenCalled()
  })

  it("FUND_006 gelince teknik metni göstermez", async () => {
    mocks.createFundDraft.mockRejectedValue(
      toApiRequestError(
        {
          code: "FUND_006",
          message: "The unit price is outside the allowed range.",
        },
        400,
        "Fon taslağı oluşturulamadı",
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole("button", { name: "İleri →" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Fon pay fiyatı izin verilen aralığın dışında.",
    )
    expect(alert).not.toHaveTextContent("outside the allowed range")
  })

  it("init alınamazsa tekrar denemeye izin verir", async () => {
    mocks.getFundDraftInit.mockRejectedValueOnce(
      new Error("Fon taslağı başlangıç verisi alınamadı."),
    )
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fon taslağı başlangıç verisi alınamadı.",
    )
    expect(
      screen.getByRole("button", { name: "Tekrar dene" }),
    ).toBeInTheDocument()
  })
})
