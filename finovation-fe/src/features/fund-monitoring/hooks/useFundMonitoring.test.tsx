import { act, renderHook, waitFor } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  fetchFunds: vi.fn(),

  fetchFundMonitoring: vi.fn(),
}))

vi.mock(
  "@/features/fund-monitoring/api/fundMonitoringService",

  () => serviceMocks,
)

import { useFundMonitoring } from "@/features/fund-monitoring/hooks/useFundMonitoring"

const FUNDS = [
  {
    id: "11111111-1111-4111-8111-111111111111",

    name: "Finovation Atlas Fonu",

    type: "Hisse Senedi Yoğun Fon",
  },

  {
    id: "22222222-2222-4222-8222-222222222222",

    name: "Finovation Nova Fonu",

    type: "Hisse Senedi Yoğun Fon",
  },
]

function snapshot(fund = FUNDS[0]) {
  return {
    fund,

    asOfDate: "2026-08-04",

    currency: "TRY",

    currentSharePrice: 100,

    dailyChangePercentage: 0,
    priceHistory: {},
    benchmark: {
      name: "Fon Karşılaştırma Ölçütü",
      components: [],
    },
    technicalIndicators: [],
    periodReturns: [],

    positions: [],

    sectorAllocations: [],
  }
}

describe("useFundMonitoring", () => {
  beforeEach(() => {
    serviceMocks.fetchFunds.mockReset().mockResolvedValue(FUNDS)

    serviceMocks.fetchFundMonitoring

      .mockReset()

      .mockImplementation((fundId) =>
        Promise.resolve(snapshot(FUNDS.find((fund) => fund.id === fundId))),
      )
  })

  it("ilk görünür fonu seçip izleme verisini yükler", async () => {
    const { result } = renderHook(() => useFundMonitoring())

    await waitFor(() => expect(result.current.snapshot).not.toBeNull())

    expect(result.current.selectedFundId).toBe(FUNDS[0].id)

    expect(serviceMocks.fetchFundMonitoring).toHaveBeenCalledWith(
      FUNDS[0].id,

      expect.any(AbortSignal),
    )
  })

  it("fon seçimi değiştiğinde eski veriyi temizleyip yeni fonu yükler", async () => {
    const { result } = renderHook(() => useFundMonitoring())

    await waitFor(() => expect(result.current.snapshot).not.toBeNull())

    act(() => result.current.selectFund(FUNDS[1].id))

    await waitFor(() =>
      expect(result.current.snapshot?.fund.id).toBe(FUNDS[1].id),
    )

    expect(serviceMocks.fetchFundMonitoring).toHaveBeenLastCalledWith(
      FUNDS[1].id,

      expect.any(AbortSignal),
    )
  })
})
