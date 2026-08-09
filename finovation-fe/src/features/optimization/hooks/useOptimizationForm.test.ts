import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fundMonitoringMocks = vi.hoisted(() => ({
  fetchFundMonitoring: vi.fn(),
}))
const optimizationApiMocks = vi.hoisted(() => ({
  createOptimizationRequest: vi.fn(),
  fetchInvestmentUniverse: vi.fn(),
  fetchOptimizableFunds: vi.fn(),
}))

vi.mock(
  "@/features/fund-monitoring/api/fundMonitoringService",
  () => fundMonitoringMocks,
)
vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

import { useOptimizationForm } from "@/features/optimization/hooks/useOptimizationForm"
import { ApiRequestError } from "@/shared/api/apiError"

const FUND = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Finovation Atlas Fonu",
  type: "EQUITY_INTENSIVE" as const,
  active: true,
  lastOptimizationDate: "2026-07-28",
  stockCount: 18,
  sectorCount: 12,
  equityWeightPercent: 90,
  tppWeightPercent: 10,
}

function snapshot() {
  return {
    fund: { id: FUND.id, name: FUND.name, type: "Hisse Senedi Yoğun Fon" },
    asOfDate: "2026-08-04",
    currency: "TRY",
    currentSharePrice: 100,
    dailyChangePercentage: 0,
    priceHistory: {},
    technicalIndicators: [],
    periodReturns: [],
    positions: [
      {
        assetId: "101",
        symbol: "AKBNK.E",
        name: "Akbank",
        sectorName: "Bankacılık",
        weightPercentage: 8,
      },
      {
        assetId: "102",
        symbol: "ASELS.E",
        name: "Aselsan",
        sectorName: "Savunma",
        weightPercentage: 7,
      },
    ],
    sectorAllocations: [],
  }
}

describe("useOptimizationForm", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizableFunds.mockReset().mockResolvedValue([FUND])
    fundMonitoringMocks.fetchFundMonitoring
      .mockReset()
      .mockResolvedValue(snapshot())
    optimizationApiMocks.createOptimizationRequest.mockReset()
    optimizationApiMocks.fetchInvestmentUniverse
      .mockReset()
      .mockResolvedValue([
        { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
      ])
  })

  it("fonları ve ilk fonun anlık görüntüsünü yükler", async () => {
    const { result } = renderHook(() => useOptimizationForm())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.selectedFundId).toBe(FUND.id)
    expect(result.current.snapshot?.positions).toHaveLength(2)
    expect(result.current.universeAssets.length).toBeGreaterThan(0)
  })

  it("1. adımdan başlar ve goToPreferences/goToFundSelection ile geçiş yapar", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.step).toBe(1)

    act(() => result.current.goToPreferences())
    expect(result.current.step).toBe(2)

    act(() => result.current.goToFundSelection())
    expect(result.current.step).toBe(1)
  })

  it("risk profili değişince TPP ve hisse sayısı önerilen aralıkları günceller", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.tppMinWeight).toBe(8)
    expect(result.current.tppMaxWeight).toBe(12)
    expect(result.current.stockCountMin).toBe(21)
    expect(result.current.stockCountMax).toBe(26)

    act(() => result.current.setRiskProfile("AGGRESSIVE"))

    expect(result.current.tppMinWeight).toBe(10)
    expect(result.current.tppMaxWeight).toBe(14)
    expect(result.current.stockCountMin).toBe(16)
    expect(result.current.stockCountMax).toBe(21)

    act(() => result.current.setRiskProfile("CONSERVATIVE"))

    expect(result.current.tppMinWeight).toBe(5)
    expect(result.current.tppMaxWeight).toBe(10)
    expect(result.current.stockCountMin).toBe(25)
    expect(result.current.stockCountMax).toBe(30)
  })

  it("varsayılan aralıklarla uyumluluk durumu geçerlidir ve gönderime izin verir", async () => {
    const { result } = renderHook(() => useOptimizationForm())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.canSubmit).toBe(true)
    expect(
      result.current.complianceRows.every((row) => row.status !== "UYUMSUZ"),
    ).toBe(true)
  })

  it("hisse sayısı aralığı minimum genişliği ihlal ettiğinde gönderimi engeller", async () => {
    const { result } = renderHook(() => useOptimizationForm())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setStockCountMin(34))

    expect(result.current.canSubmit).toBe(false)
  })

  it("bir hisseyi korumaya alınca ağırlığı uygunluk satırlarına yansıtır", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("101", "KEEP"))

    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))
    const keptRow = result.current.complianceRows.find(
      (row) => row.key === "kept-assets",
    )
    expect(keptRow?.detail).toContain("toplam %8")
  })

  it("aynı hisseye tekrar tıklanınca seçimi kaldırır", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("101", "KEEP"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))

    act(() => result.current.toggleSelection("101", "KEEP"))

    await waitFor(() => expect(result.current.selection["101"]).toBeUndefined())
  })

  it("submit çağrıldığında isteği doğru payload ile gönderip onSubmitted'ı çağırır", async () => {
    optimizationApiMocks.createOptimizationRequest.mockResolvedValue({
      id: 42,
    })

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("101", "KEEP"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))

    const onSubmitted = vi.fn()
    await act(async () => {
      await result.current.submit(onSubmitted)
    })

    expect(optimizationApiMocks.createOptimizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        fundId: FUND.id,
        riskProfile: "BALANCED",
        tppMinWeight: 8,
        tppMaxWeight: 12,
        stockCountMin: 21,
        stockCountMax: 26,
        assetPreferences: [
          {
            assetCode: "AKBNK.E",
            preferenceType: "KEEP",
            currentWeight: 8,
          },
        ],
      }),
    )
    expect(onSubmitted).toHaveBeenCalledWith(42)
  })

  it("gönderim başarısız olduğunda hata mesajını kullanıcı diline çevirir", async () => {
    optimizationApiMocks.createOptimizationRequest.mockRejectedValue(
      new ApiRequestError("Optimizasyon senaryosu oluşturulamadı.", 500),
    )

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.submit(vi.fn())
    })

    expect(result.current.submitErrorMessage).toBe(
      "Optimizasyon senaryosu oluşturulamadı.",
    )
    expect(result.current.isSubmitting).toBe(false)
  })

  it("gönderime hazır olmadığında submit isteği göndermez", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setStockCountMin(34))
    expect(result.current.canSubmit).toBe(false)

    await act(async () => {
      await result.current.submit(vi.fn())
    })

    expect(
      optimizationApiMocks.createOptimizationRequest,
    ).not.toHaveBeenCalled()
  })
})
