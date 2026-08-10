import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationRequest: vi.fn(),
  fetchOptimizationResult: vi.fn(),
  approveOptimizationRequest: vi.fn(),
  rejectOptimizationRequest: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

import { useOptimizationResultReview } from "@/features/optimization/hooks/useOptimizationResultReview"
import { ApiRequestError } from "@/shared/api/apiError"

const COMPLETED_REQUEST = {
  id: 1,
  fundId: 42,
  dataTimestamp: null,
  modelVersion: null,
  requestedByUserId: 7,
  requestedByUsername: "fon-yoneticisi",
  riskProfile: "BALANCED",
  status: "COMPLETED",
  tppMinWeight: 5,
  tppMaxWeight: 15,
  stockCountMin: 16,
  stockCountMax: 30,
  startedAt: null,
  completedAt: "2026-08-07T09:00:00",
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:00:00",
} as const

const SECTORS = ["Bankacılık", "Savunma", "Perakende", "Enerji"]

const RESULT = {
  generatedAt: "2026-08-07T09:00:00",
  assets: [
    ...Array.from({ length: 16 }, (_unused, index) => ({
      assetCode: `STK${index}`,
      name: `Hisse ${index}`,
      sectorName: SECTORS[index % SECTORS.length],
      assetType: "EQUITY" as const,
      currentWeight: 5.375,
      proposedWeight: 5.375,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    })),
    {
      assetCode: "TPP1G",
      name: "TPP",
      sectorName: null,
      assetType: "TPP" as const,
      currentWeight: 14,
      proposedWeight: 14,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    },
  ],
  metrics: [],
}

describe("useOptimizationResultReview", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizationRequest
      .mockReset()
      .mockResolvedValue(COMPLETED_REQUEST)
    optimizationApiMocks.fetchOptimizationResult
      .mockReset()
      .mockResolvedValue(RESULT)
    optimizationApiMocks.approveOptimizationRequest.mockReset()
    optimizationApiMocks.rejectOptimizationRequest.mockReset()
  })

  it("isteği yükleyip incelenebilir olarak işaretler", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))

    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.isReviewable).toBe(true)
    expect(result.current.reviewStep).toBe(3)
    expect(result.current.assets.length).toBeGreaterThan(0)
  })

  it("istek COMPLETED değilse incelenebilir değildir", async () => {
    optimizationApiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "RUNNING",
    })
    const { result } = renderHook(() => useOptimizationResultReview(1))

    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.isReviewable).toBe(false)
  })

  it("istek zaten APPROVED ise decidedAs'ı otomatik 'approve' yapar", async () => {
    optimizationApiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "APPROVED",
    })
    const { result } = renderHook(() => useOptimizationResultReview(1))

    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.decidedAs).toBe("approve")
  })

  it("goToApproval/goToResult ile adımlar arasında geçiş yapar", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    act(() => result.current.goToApproval())
    expect(result.current.reviewStep).toBe(4)

    act(() => result.current.goToResult())
    expect(result.current.reviewStep).toBe(3)
  })

  it("final ağırlık değiştirildiğinde manuallyOverridden'ı işaretler", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))
    const assetCode = result.current.assets[0].assetCode

    act(() => result.current.setFinalWeight(assetCode, 42))

    const updated = result.current.assets.find(
      (asset) => asset.assetCode === assetCode,
    )
    expect(updated?.finalWeight).toBe(42)
    expect(updated?.manuallyOverridden).toBe(true)
    expect(result.current.summary.overriddenCount).toBe(1)
  })

  it("resetFinalWeight ile manuel işaretini kaldırır", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))
    const assetCode = result.current.assets[0].assetCode

    act(() => result.current.setFinalWeight(assetCode, 42))
    act(() => result.current.resetFinalWeight(assetCode))

    const updated = result.current.assets.find(
      (asset) => asset.assetCode === assetCode,
    )
    expect(updated?.finalWeight).toBeNull()
    expect(updated?.manuallyOverridden).toBe(false)
  })

  it("resetAllFinalWeights sadece manuel değiştirilenlerin işaretini kaldırır, diğerlerine dokunmaz", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))
    const [firstCode, secondCode] = result.current.assets.map(
      (asset) => asset.assetCode,
    )

    act(() => result.current.setFinalWeight(firstCode, 42))
    act(() => result.current.setFinalWeight(secondCode, 17))
    expect(result.current.summary.overriddenCount).toBe(2)

    act(() => result.current.resetAllFinalWeights())

    expect(result.current.summary.overriddenCount).toBe(0)
    const first = result.current.assets.find(
      (asset) => asset.assetCode === firstCode,
    )
    const second = result.current.assets.find(
      (asset) => asset.assetCode === secondCode,
    )
    expect(first?.finalWeight).toBeNull()
    expect(first?.manuallyOverridden).toBe(false)
    expect(second?.finalWeight).toBeNull()
    expect(second?.manuallyOverridden).toBe(false)
  })

  it("summary, ekrandaki kategori mantığıyla hesaplanır — actionType'a göre değil görünür değişime göre sayar", async () => {
    optimizationApiMocks.fetchOptimizationResult.mockResolvedValue({
      generatedAt: RESULT.generatedAt,
      assets: [
        {
          assetCode: "TCELL",
          name: "Turkcell",
          sectorName: "Telekomünikasyon",
          assetType: "EQUITY",
          currentWeight: 6.3,
          proposedWeight: 6.4,
          finalWeight: null,
          changeAmount: 0.1,
          actionType: "INCREASE",
          manuallyOverridden: false,
          rationale: null,
        },
        {
          assetCode: "MGROS",
          name: "Migros",
          sectorName: "Perakende Ticaret",
          assetType: "EQUITY",
          currentWeight: 9,
          proposedWeight: 12,
          finalWeight: null,
          changeAmount: 3,
          actionType: "INCREASE",
          manuallyOverridden: false,
          rationale: null,
        },
      ],
      metrics: [],
    })

    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.summary.increasedCount).toBe(1)
  })

  it("decide('approve') başarılı olduğunda decidedAs'ı 'approve' yapar", async () => {
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).toHaveBeenCalledWith(1, [])
    expect(result.current.decidedAs).toBe("approve")
    expect(result.current.isSubmitting).toBe(false)
  })

  it("decide('approve') backend'den dönen gerçek onaylayan/zaman bilgisini request state'ine yansıtır", async () => {
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "APPROVED",
      decidedByUserId: 3,
      decidedByUsername: "onay-veren-yonetici",
      updatedAt: "2026-08-10T16:53:00",
    })
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(result.current.request?.decidedByUsername).toBe(
      "onay-veren-yonetici",
    )
    expect(result.current.request?.status).toBe("APPROVED")
  })

  it("decide('approve') elle değiştirilen ağırlıkları override olarak gönderir", async () => {
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    act(() => result.current.setFinalWeight("STK0", 5.5))

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).toHaveBeenCalledWith(1, [{ assetCode: "STK0", finalWeight: 5.5 }])
  })

  it("decide('reject') başarılı olduğunda decidedAs'ı 'reject' yapar", async () => {
    optimizationApiMocks.rejectOptimizationRequest.mockResolvedValue({})
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    await act(async () => {
      await result.current.decide("reject")
    })

    expect(optimizationApiMocks.rejectOptimizationRequest).toHaveBeenCalledWith(
      1,
    )
    expect(result.current.decidedAs).toBe("reject")
  })

  it("decide başarısız olduğunda hata mesajını kullanıcı diline çevirir", async () => {
    optimizationApiMocks.approveOptimizationRequest.mockRejectedValue(
      new ApiRequestError("Optimizasyon sonucu onaylanamadı.", 500),
    )
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(result.current.submitErrorMessage).toBe(
      "Optimizasyon sonucu onaylanamadı.",
    )
    expect(result.current.decidedAs).toBeNull()
  })

  it("kısıt/bilgi metriklerini hesaplayıp döner", async () => {
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.constraintMetrics.length).toBe(6)
    expect(result.current.infoMetrics.length).toBe(9)
    expect(result.current.isApprovalBlocked).toBe(false)
  })

  it("gerçek sonuçtan gelen risk metriklerini current/proposed değerlerine yansıtır", async () => {
    optimizationApiMocks.fetchOptimizationResult.mockResolvedValue({
      generatedAt: "2026-08-07T09:00:00",
      assets: RESULT.assets,
      metrics: [
        { key: "BETA", currentValue: 1.1, proposedValue: 0.95 },
        { key: "SHARPE_RATIO", currentValue: 0.8, proposedValue: 1.2 },
      ],
    })

    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    const beta = result.current.infoMetrics.find((metric) => metric.key === "BETA")
    expect(beta?.currentValue).toBe(1.1)
    expect(beta?.proposedValue).toBe(0.95)

    const sharpe = result.current.infoMetrics.find(
      (metric) => metric.key === "SHARPE_RATIO",
    )
    expect(sharpe?.currentValue).toBe(0.8)
    expect(sharpe?.proposedValue).toBe(1.2)

    const alpha = result.current.infoMetrics.find((metric) => metric.key === "ALPHA")
    expect(alpha?.currentValue).toBeNull()
    expect(alpha?.proposedValue).toBeNull()
  })

  it("kısıt metriği kırmızıysa isApprovalBlocked true olur ve decide('approve') no-op kalır", async () => {
    optimizationApiMocks.fetchOptimizationResult.mockResolvedValue({
      generatedAt: "2026-08-07T09:00:00",
      assets: [
        {
          assetCode: "STK0",
          name: "Hisse 0",
          sectorName: "Bankacılık",
          assetType: "EQUITY",
          currentWeight: 40,
          proposedWeight: 40,
          finalWeight: null,
          changeAmount: 0,
          actionType: "KEEP",
          manuallyOverridden: false,
          rationale: null,
        },
        {
          assetCode: "TPP1G",
          name: "TPP",
          sectorName: null,
          assetType: "TPP",
          currentWeight: 60,
          proposedWeight: 60,
          finalWeight: null,
          changeAmount: 0,
          actionType: "KEEP",
          manuallyOverridden: false,
          rationale: null,
        },
      ],
      metrics: [],
    })

    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    expect(result.current.isApprovalBlocked).toBe(true)

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).not.toHaveBeenCalled()
    expect(result.current.decidedAs).toBeNull()
  })
})
