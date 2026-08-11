import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const dashboardServiceMocks = vi.hoisted(() => ({
  loadDashboardOverview: vi.fn(),
  loadFundPerformance: vi.fn(),
}))

vi.mock(
  "@/features/dashboard/api/dashboardService",
  () => dashboardServiceMocks,
)

import { useDashboard } from "@/features/dashboard/hooks/useDashboard"

const FUNDS = [
  { id: "fund-1", name: "Birinci Fon", type: "Hisse Senedi Yoğun Fon" },
  { id: "fund-2", name: "İkinci Fon", type: "Hisse Senedi Yoğun Fon" },
]

const OVERVIEW = {
  data: {
    businessDate: "2026-08-11",
    funds: FUNDS,
    draftCount: 5,
    drafts: [],
    optimizationLogs: [],
    latestOptimizationResult: null,
    stressTests: [],
  },
  errors: {
    funds: "",
    drafts: "",
    optimization: "",
    stressTests: "",
  },
}

function snapshot(fund: typeof FUNDS[number]) {
  return {
    fund,
    asOfDate: "2026-08-11",
    currency: "TRY",
    periodReturns: [],
    priceHistory: { "1M": [] },
  }
}

function deferred<T>() {
  let resolverRef: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolver) => {
    resolverRef = resolver
  })
  return {
    promise,
    resolve(value: T) {
      if (!resolverRef) throw new Error("Deferred promise is not initialized")
      resolverRef(value)
    },
  }
}

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardServiceMocks.loadDashboardOverview.mockResolvedValue(OVERVIEW)
  })

  it("özeti yükler, ilk fonu seçer ve performansını getirir", async () => {
    dashboardServiceMocks.loadFundPerformance.mockResolvedValue(
      snapshot(FUNDS[0]),
    )

    const { result } = renderHook(() => useDashboard())

    await waitFor(() => expect(result.current.selectedFundId).toBe("fund-1"))
    await waitFor(() =>
      expect(result.current.monitoringSnapshot?.fund.id).toBe("fund-1"),
    )

    expect(result.current.draftCount).toBe(5)
    expect(dashboardServiceMocks.loadFundPerformance).toHaveBeenCalledWith(
      "fund-1",
      expect.any(AbortSignal),
    )
  })

  it("fon seçimi değiştiğinde geciken eski cevabın state'i ezmesine izin vermez", async () => {
    const firstRequest = deferred<ReturnType<typeof snapshot>>()
    dashboardServiceMocks.loadFundPerformance.mockImplementation(
      (fundId: string) =>
        fundId === "fund-1"
          ? firstRequest.promise
          : Promise.resolve(snapshot(FUNDS[1])),
    )

    const { result } = renderHook(() => useDashboard())
    await waitFor(() =>
      expect(dashboardServiceMocks.loadFundPerformance).toHaveBeenCalledWith(
        "fund-1",
        expect.any(AbortSignal),
      ),
    )

    act(() => result.current.selectFund("fund-2"))
    await waitFor(() =>
      expect(result.current.monitoringSnapshot?.fund.id).toBe("fund-2"),
    )

    await act(async () => firstRequest.resolve(snapshot(FUNDS[0])))
    expect(result.current.monitoringSnapshot?.fund.id).toBe("fund-2")
  })

  it("manuel yenilemede hem özeti hem seçili fon performansını tekrar yükler", async () => {
    dashboardServiceMocks.loadFundPerformance.mockResolvedValue(
      snapshot(FUNDS[0]),
    )
    const { result } = renderHook(() => useDashboard())

    await waitFor(() =>
      expect(dashboardServiceMocks.loadFundPerformance).toHaveBeenCalledTimes(
        1,
      ),
    )

    act(() => result.current.reload())

    await waitFor(() =>
      expect(dashboardServiceMocks.loadDashboardOverview).toHaveBeenCalledTimes(
        2,
      ),
    )
    await waitFor(() =>
      expect(dashboardServiceMocks.loadFundPerformance).toHaveBeenCalledTimes(
        2,
      ),
    )
  })
})
