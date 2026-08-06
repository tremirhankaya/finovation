import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  createFundDraft,
  getFundDraftInit,
} from "@/features/fund-design/api/fundDraftApi"

describe("fundDraftApi", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
  })

  it("init verisini GET /fund-drafts/init üzerinden alır", async () => {
    httpMocks.apiFetch.mockResolvedValue({
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
    })

    await getFundDraftInit()

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/fund-drafts/init",
      expect.objectContaining({
        errorMessage: "Fon taslağı başlangıç verisi alınamadı",
      }),
      expect.any(Function),
    )
  })

  it("taslak oluşturmayı POST /fund-drafts ile gönderir", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      draftId: "11111111-1111-1111-1111-111111111111",
    })

    await createFundDraft({
      name: "Finovation Hisse Senedi Fonu",
      initialPortfolioSize: 100_000_000,
      unitPrice: 17,
    })

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/fund-drafts",
      expect.objectContaining({
        method: "POST",
        body: {
          name: "Finovation Hisse Senedi Fonu",
          initialPortfolioSize: 100_000_000,
          unitPrice: 17,
        },
      }),
      expect.any(Function),
    )
  })
})
