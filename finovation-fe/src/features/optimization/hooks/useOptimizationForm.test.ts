import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fundMonitoringMocks = vi.hoisted(() => ({
  fetchFunds: vi.fn(),
  fetchFundMonitoring: vi.fn(),
}))
const optimizationApiMocks = vi.hoisted(() => ({
  createOptimizationRequest: vi.fn(),
  fetchInvestmentUniverse: vi.fn(),
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
  type: "Hisse Senedi Yoğun Fon",
}

function snapshot() {
  return {
    fund: FUND,
    asOfDate: "2026-08-04",
    currency: "TRY",
    currentSharePrice: 100,
    dailyChangePercentage: 0,
    priceHistory: {},
    technicalIndicators: [],
    periodReturns: [],
    positions: [
      {
        assetId: "AKBNK",
        symbol: "AKBNK",
        name: "Akbank",
        sectorName: "Bankacılık",
        weightPercentage: 8,
      },
      {
        assetId: "ASELS",
        symbol: "ASELS",
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
    fundMonitoringMocks.fetchFunds.mockReset().mockResolvedValue([FUND])
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

    act(() => result.current.toggleSelection("AKBNK", "KEEP"))

    await waitFor(() => expect(result.current.selection.AKBNK).toBe("KEEP"))
    const keptRow = result.current.complianceRows.find(
      (row) => row.key === "kept-assets",
    )
    expect(keptRow?.detail).toContain("toplam %8")
  })

  it("aynı hisseye tekrar tıklanınca seçimi kaldırır", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("AKBNK", "KEEP"))
    await waitFor(() => expect(result.current.selection.AKBNK).toBe("KEEP"))

    act(() => result.current.toggleSelection("AKBNK", "KEEP"))

    await waitFor(() => expect(result.current.selection.AKBNK).toBeUndefined())
  })

  it("submit çağrıldığında isteği doğru payload ile gönderip onSubmitted'ı çağırır", async () => {
    optimizationApiMocks.createOptimizationRequest.mockResolvedValue({
      id: 42,
    })

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("AKBNK", "KEEP"))
    await waitFor(() => expect(result.current.selection.AKBNK).toBe("KEEP"))

    const onSubmitted = vi.fn()
    await act(async () => {
      await result.current.submit(onSubmitted)
    })

    expect(optimizationApiMocks.createOptimizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        fundId: FUND.id,
        riskProfile: "BALANCED",
        tppMinWeight: 5,
        tppMaxWeight: 15,
        stockCountMin: 16,
        stockCountMax: 30,
        assetPreferences: [
          {
            assetCode: "AKBNK",
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
