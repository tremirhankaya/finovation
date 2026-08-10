import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  createOptimizationRequest: vi.fn(),
  fetchInvestmentUniverse: vi.fn(),
  fetchOptimizableFunds: vi.fn(),
  fetchOptimizationFundPositions: vi.fn(),
}))

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
    fundName: FUND.name,
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
  }
}

describe("useOptimizationForm", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizableFunds.mockReset().mockResolvedValue([FUND])
    optimizationApiMocks.fetchOptimizationFundPositions
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

    expect(result.current.tppMinWeight).toBe(5)
    expect(result.current.tppMaxWeight).toBe(10)
    expect(result.current.stockCountMin).toBe(25)
    expect(result.current.stockCountMax).toBe(30)

    act(() => result.current.setRiskProfile("CONSERVATIVE"))

    expect(result.current.tppMinWeight).toBe(10)
    expect(result.current.tppMaxWeight).toBe(15)
    expect(result.current.stockCountMin).toBe(16)
    expect(result.current.stockCountMax).toBe(21)
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

  it("korunmayan bir hisse %10'u aşsa da gönderimi engellemez, korunan hisse aşarsa engeller", async () => {
    optimizationApiMocks.fetchOptimizationFundPositions.mockReset().mockResolvedValue({
      ...snapshot(),
      positions: [
        {
          assetId: "101",
          symbol: "AKBNK.E",
          name: "Akbank",
          sectorName: "Bankacılık",
          weightPercentage: 13,
        },
        {
          assetId: "102",
          symbol: "ASELS.E",
          name: "Aselsan",
          sectorName: "Savunma",
          weightPercentage: 7,
        },
      ],
    })

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.canSubmit).toBe(true)
    const singleStockRowBefore = result.current.complianceRows.find(
      (row) => row.key === "single-stock-weight",
    )
    expect(singleStockRowBefore?.status).toBe("UYUMLU")

    act(() => result.current.toggleSelection("101", "KEEP"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))

    const singleStockRowAfter = result.current.complianceRows.find(
      (row) => row.key === "single-stock-weight",
    )
    expect(singleStockRowAfter?.status).toBe("UYUMSUZ")
    expect(result.current.canSubmit).toBe(false)
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

  it("kısıtlar önerilen profil değerlerinden sapınca constraintsDeviateFromProfile true olur", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.constraintsDeviateFromProfile).toBe(false)

    act(() => result.current.setTppMinWeight(9))

    expect(result.current.constraintsDeviateFromProfile).toBe(true)

    act(() => result.current.setTppMinWeight(8))

    expect(result.current.constraintsDeviateFromProfile).toBe(false)
  })

  it("risk profili değişince constraintsDeviateFromProfile yeniden false olur", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setStockCountMax(25))
    expect(result.current.constraintsDeviateFromProfile).toBe(true)

    act(() => result.current.setRiskProfile("AGGRESSIVE"))

    expect(result.current.constraintsDeviateFromProfile).toBe(false)
  })

  it("toggleHeldKeep bir pozisyonu korumaya alır ve tekrar tıklanınca kaldırır", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldKeep("101"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))

    act(() => result.current.toggleHeldKeep("101"))
    await waitFor(() => expect(result.current.selection["101"]).toBeUndefined())
  })

  it("toggleHeldExclude bir pozisyonu excludedHeldAssetIds'e ekler ve tekrar tıklanınca kaldırır", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldExclude("101"))
    await waitFor(() =>
      expect(result.current.excludedHeldAssetIds.has("101")).toBe(true),
    )

    act(() => result.current.toggleHeldExclude("101"))
    await waitFor(() =>
      expect(result.current.excludedHeldAssetIds.has("101")).toBe(false),
    )
  })

  it("TPP1G bir hisse olmadığı için ne koru ne çıkar ile seçilebilir", async () => {
    optimizationApiMocks.fetchOptimizationFundPositions.mockReset().mockResolvedValue({
      ...snapshot(),
      positions: [
        ...snapshot().positions,
        {
          assetId: "999",
          symbol: "TPP1G",
          name: "TPP Fonu",
          sectorName: null,
          weightPercentage: 10,
        },
      ],
    })

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldKeep("999"))
    expect(result.current.selection["999"]).toBeUndefined()

    act(() => result.current.toggleHeldExclude("999"))
    expect(result.current.excludedHeldAssetIds.has("999")).toBe(false)
  })

  it("koru ve çıkar aynı pozisyon için birbirini iptal eder", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldKeep("101"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))

    act(() => result.current.toggleHeldExclude("101"))
    await waitFor(() =>
      expect(result.current.excludedHeldAssetIds.has("101")).toBe(true),
    )
    expect(result.current.selection["101"]).toBeUndefined()

    act(() => result.current.toggleHeldKeep("101"))
    await waitFor(() => expect(result.current.selection["101"]).toBe("KEEP"))
    expect(result.current.excludedHeldAssetIds.has("101")).toBe(false)
  })

  it("resetConstraintsToSuggested kısıtları mevcut risk profilinin varsayılanına döndürür", async () => {
    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setTppMinWeight(9))
    act(() => result.current.setStockCountMax(25))
    expect(result.current.constraintsDeviateFromProfile).toBe(true)

    act(() => result.current.resetConstraintsToSuggested())

    expect(result.current.tppMinWeight).toBe(8)
    expect(result.current.tppMaxWeight).toBe(12)
    expect(result.current.stockCountMin).toBe(21)
    expect(result.current.stockCountMax).toBe(26)
    expect(result.current.constraintsDeviateFromProfile).toBe(false)
  })

  it("unheldUniverseAssets zaten fonda olan hisseleri listeden çıkarır", async () => {
    optimizationApiMocks.fetchInvestmentUniverse.mockReset().mockResolvedValue([
      { assetCode: "AKBNK.E", name: "Akbank", sectorName: "Bankacılık" },
      { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
    ])

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.universeAssets.map((a) => a.assetCode)).toEqual([
      "AKBNK.E",
      "MGROS",
    ])
    expect(
      result.current.unheldUniverseAssets.map((a) => a.assetCode),
    ).toEqual(["MGROS"])
  })

  it("toggleHeldKeep en fazla 3 hisseyle sınırlıdır", async () => {
    optimizationApiMocks.fetchOptimizationFundPositions.mockReset().mockResolvedValue({
      ...snapshot(),
      positions: [
        { assetId: "101", symbol: "AKBNK.E", name: "Akbank", sectorName: "Bankacılık", weightPercentage: 5 },
        { assetId: "102", symbol: "ASELS.E", name: "Aselsan", sectorName: "Savunma", weightPercentage: 5 },
        { assetId: "103", symbol: "GARAN.E", name: "Garanti", sectorName: "Bankacılık", weightPercentage: 5 },
        { assetId: "104", symbol: "THYAO.E", name: "THY", sectorName: "Ulaştırma", weightPercentage: 5 },
      ],
    })

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldKeep("101"))
    act(() => result.current.toggleHeldKeep("102"))
    act(() => result.current.toggleHeldKeep("103"))
    await waitFor(() => expect(result.current.keepCount).toBe(3))

    act(() => result.current.toggleHeldKeep("104"))

    expect(result.current.keepCount).toBe(3)
    expect(result.current.selection["104"]).toBeUndefined()
  })

  it("B panelindeki Çıkar en fazla 3 ile sınırlıdır ve C panelini etkilemez", async () => {
    optimizationApiMocks.fetchOptimizationFundPositions.mockReset().mockResolvedValue({
      ...snapshot(),
      positions: [
        { assetId: "101", symbol: "AKBNK.E", name: "Akbank", sectorName: "Bankacılık", weightPercentage: 5 },
        { assetId: "102", symbol: "ASELS.E", name: "Aselsan", sectorName: "Savunma", weightPercentage: 5 },
        { assetId: "103", symbol: "GARAN.E", name: "Garanti", sectorName: "Bankacılık", weightPercentage: 5 },
        { assetId: "104", symbol: "THYAO.E", name: "THY", sectorName: "Ulaştırma", weightPercentage: 5 },
      ],
    })
    optimizationApiMocks.fetchInvestmentUniverse.mockReset().mockResolvedValue([
      { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
    ])

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleHeldExclude("101"))
    act(() => result.current.toggleHeldExclude("102"))
    act(() => result.current.toggleHeldExclude("103"))
    await waitFor(() => expect(result.current.heldExcludeCount).toBe(3))

    act(() => result.current.toggleHeldExclude("104"))
    expect(result.current.heldExcludeCount).toBe(3)
    expect(result.current.excludedHeldAssetIds.has("104")).toBe(false)

    act(() => result.current.toggleSelection("MGROS", "EXCLUDE"))
    expect(result.current.universeExcludeCount).toBe(1)
    expect(result.current.selection["MGROS"]).toBe("EXCLUDE")
  })

  it("C panelindeki Hariç Tut en fazla 3 ile sınırlıdır ve B panelini etkilemez", async () => {
    optimizationApiMocks.fetchInvestmentUniverse.mockReset().mockResolvedValue([
      { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
      { assetCode: "TTKOM", name: "Türk Telekom", sectorName: "Telekomünikasyon" },
      { assetCode: "BIMAS", name: "BİM", sectorName: "Perakende Ticaret" },
      { assetCode: "EREGL", name: "Ereğli Demir Çelik", sectorName: "Ana Metal Sanayi" },
    ])

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("MGROS", "EXCLUDE"))
    act(() => result.current.toggleSelection("TTKOM", "EXCLUDE"))
    act(() => result.current.toggleSelection("BIMAS", "EXCLUDE"))
    await waitFor(() => expect(result.current.universeExcludeCount).toBe(3))

    act(() => result.current.toggleSelection("EREGL", "EXCLUDE"))
    expect(result.current.universeExcludeCount).toBe(3)
    expect(result.current.selection["EREGL"]).toBeUndefined()

    act(() => result.current.toggleHeldExclude("101"))
    expect(result.current.heldExcludeCount).toBe(1)
  })

  it("zorunlu eklenecek hisseler en fazla 3 ile sınırlıdır", async () => {
    optimizationApiMocks.fetchInvestmentUniverse.mockReset().mockResolvedValue([
      { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
      { assetCode: "TTKOM", name: "Türk Telekom", sectorName: "Telekomünikasyon" },
      { assetCode: "BIMAS", name: "BİM", sectorName: "Perakende Ticaret" },
      { assetCode: "EREGL", name: "Ereğli Demir Çelik", sectorName: "Ana Metal Sanayi" },
    ])

    const { result } = renderHook(() => useOptimizationForm())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.toggleSelection("MGROS", "FORCE_ADD"))
    act(() => result.current.toggleSelection("TTKOM", "FORCE_ADD"))
    act(() => result.current.toggleSelection("BIMAS", "FORCE_ADD"))
    await waitFor(() => expect(result.current.forceAddCount).toBe(3))

    act(() => result.current.toggleSelection("EREGL", "FORCE_ADD"))

    expect(result.current.forceAddCount).toBe(3)
    expect(result.current.selection["EREGL"]).toBeUndefined()
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
