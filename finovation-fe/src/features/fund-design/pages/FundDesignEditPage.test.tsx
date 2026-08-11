import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

const fundDraftApiMocks = vi.hoisted(() => ({
  getFundDraftAnalysisState: vi.fn(),
  getWorkingPortfolio: vi.fn(),
  updateWorkingPortfolio: vi.fn(),
}))
const fundDraftInitMocks = vi.hoisted(() => ({
  useFundDraftInit: vi.fn(),
}))

vi.mock("@/features/fund-design/api/fundDraftApi", () => fundDraftApiMocks)
vi.mock(
  "@/features/fund-design/hooks/useFundDraftInit",
  () => fundDraftInitMocks,
)

import FundDesignEditPage from "@/features/fund-design/pages/FundDesignEditPage"

const DRAFT_ID = "11111111-1111-4111-8111-111111111111"

const INIT = {
  page: "EDIT",
  draft: {
    draftId: DRAFT_ID,
    name: "Finovation Atlas",
    managementApproach: "BALANCED",
    tppMinPct: null,
    tppMaxPct: null,
    preferredTppPct: null,
    minStockCount: 2,
    maxStockCount: 5,
    equityMinPct: 50,
    equityMaxPct: 90,
    singleStockMaxPct: 30,
    draftVersion: 1,
    currentStep: 5,
    excludedAssetCodes: [],
    forcedAssetCodes: [],
  },
  modelUniverse: [
    { assetCode: "AKBNK", displayName: "Akbank" },
    { assetCode: "GARAN", displayName: "Garanti Bankası" },
    { assetCode: "THYAO", displayName: "Türk Hava Yolları" },
  ],
  minLiquidityTargetPct: 10,
  maxLiquidityTargetPct: 20,
  minTppRangePct: 5,
  minStockCount: 2,
  maxStockCount: 5,
  minStockCountRange: 1,
  minSingleStockMaxPct: 0,
  maxSingleStockMaxPct: 30,
  minEquityWeightPct: 50,
  maxEquityWeightPct: 90,
  sectorMaxPct: 40,
} as const

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/fund-design/${DRAFT_ID}/edit`]}>
      <Routes>
        <Route
          path="/fund-design/:draftId/edit"
          element={<FundDesignEditPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("FundDesignEditPage", () => {
  it("bulk delete confirmation shows selected stock names", async () => {
    const user = userEvent.setup()

    fundDraftInitMocks.useFundDraftInit.mockReturnValue({
      init: INIT,
      error: "",
      isLoading: false,
      reload: vi.fn(),
    })
    fundDraftApiMocks.getFundDraftAnalysisState.mockResolvedValue({
      rulesFingerprint: "fingerprint",
      proposals: [{ rank: 1, label: "AI Önerisi", assets: [] }],
      selectedRank: 1,
    })
    fundDraftApiMocks.getWorkingPortfolio.mockResolvedValue({
      assets: [
        {
          asset_code: "AKBNK",
          weight: 45,
          asset_type: "EQUITY",
          sector_name: "Bankacılık",
        },
        {
          asset_code: "GARAN",
          weight: 35,
          asset_type: "EQUITY",
          sector_name: "Bankacılık",
        },
        {
          asset_code: "THYAO",
          weight: 20,
          asset_type: "TPP",
          sector_name: null,
        },
      ],
    })

    renderPage()

    await waitFor(() => expect(screen.getByText("AKBNK")).toBeInTheDocument())

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])

    await user.click(
      screen.getByRole("button", { name: "Portföyden Çıkar (2)" }),
    )

    expect(screen.getByText("AKBNK · Akbank")).toBeInTheDocument()
    expect(screen.getByText("GARAN · Garanti Bankası")).toBeInTheDocument()
  })
})
