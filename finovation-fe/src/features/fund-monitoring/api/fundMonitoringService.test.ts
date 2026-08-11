import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  fetchFundMonitoring,
  fetchFunds,
} from "@/features/fund-monitoring/api/fundMonitoringService"

const FUND = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Finovation Atlas Fonu",
  type: "EQUITY_INTENSIVE",
  currency: "TRY",
  inceptionDate: "2025-08-05",
}

const SNAPSHOT = {
  fund: FUND,
  asOfDate: "2026-08-04",
  currency: "TRY",
  outstandingShares: 1_000_000,
  currentSharePrice: 112.5,
  dailyChangePercentage: 1.2,
  priceHistory: {
    "1W": [{ date: "2026-08-04", value: 112.5 }],
    "1M": [{ date: "2026-08-04", value: 112.5 }],
    "3M": [{ date: "2026-08-04", value: 112.5 }],
    "6M": [{ date: "2026-08-04", value: 112.5 }],
    "1Y": [{ date: "2025-08-05", value: 100 }],
  },
  backtestHistory: {
    "1W": [{ date: "2026-08-04", value: 1.125 }],
    "1M": [{ date: "2026-08-04", value: 1.125 }],
    "3M": [{ date: "2026-08-04", value: 1.125 }],
    "6M": [{ date: "2026-08-04", value: 1.125 }],
    "1Y": [{ date: "2025-08-05", value: 1 }],
  },
  backtestCurrentValue: 1.125,
  backtestDailyChangePercentage: 1.2,
  benchmark: {
    name: "Fon Karşılaştırma Ölçütü",
    components: [
      {
        code: "XU100_CFNNTLTL",
        name: "BIST 100 Getiri Endeksi",
        weightPercentage: 90,
      },
      {
        code: "REPBR",
        name: "BIST-KYD Repo (Brüt) Endeksi",
        weightPercentage: 10,
      },
    ],
  },
  technicalIndicators: [
    {
      code: "VOLATILITY",
      label: "Volatilite (Yıllık)",
      value: 18.2,
      unit: "PERCENT",
      tone: "neutral",
      description: "Son 252 işlem günündeki yıllıklandırılmış dalgalanma.",
    },
  ],
  periodReturns: [{ period: "1M", label: "1 Aylık Getiri", value: 2.1 }],
  positions: [
    {
      assetId: "1",
      symbol: "THYAO",
      name: "Türk Hava Yolları",
      sectorName: "Ulaştırma",
      weightPercentage: 18.4,
    },
  ],
  sectorAllocations: [
    {
      sectorId: "1",
      sectorName: "Ulaştırma",
      weightPercentage: 18.4,
    },
  ],
  comparisonAssets: [
    {
      id: "bist-100",
      code: "BIST100",
      name: "BIST 100",
      color: "#7c3aed",
      isFund: false,
      returns: {
        "1W": 1.1,
        "1M": 2.2,
        "3M": 3.3,
        "6M": 4.4,
        YTD: 5.5,
        "1Y": 6.6,
        "3Y": 7.7,
        "5Y": 8.8,
      },
    },
  ],
} as const

describe("fundMonitoringService", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
  })

  it("fon listesini doğrular ve görünüm modeline çevirir", async () => {
    httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
      Promise.resolve(parse([FUND])),
    )

    await expect(fetchFunds()).resolves.toEqual([
      {
        id: FUND.id,
        name: FUND.name,
        type: "Hisse Senedi Yoğun Fon",
      },
    ])
    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/funds",
      expect.objectContaining({ errorMessage: "Fonlar yüklenemedi" }),
      expect.any(Function),
    )
  })

  it("izleme yanıtını runtime şemasıyla doğrulayıp adapte eder", async () => {
    httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
      Promise.resolve(parse(SNAPSHOT)),
    )

    const result = await fetchFundMonitoring(FUND.id)

    expect(result.currentSharePrice).toBe(112.5)
    expect(result.positions[0]?.symbol).toBe("THYAO")
    expect(result.comparisonAssets).toEqual(SNAPSHOT.comparisonAssets)
    expect(result.benchmark.components).toHaveLength(2)
    expect(result.fund.type).toBe("Hisse Senedi Yoğun Fon")
    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      `/api/v1/funds/${FUND.id}/monitoring`,
      expect.objectContaining({
        errorMessage: "Fon izleme verileri yüklenemedi",
      }),
      expect.any(Function),
    )
  })
})
