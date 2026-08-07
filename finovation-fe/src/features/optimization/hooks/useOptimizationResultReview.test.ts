import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationRequest: vi.fn(),
  approveOptimizationRequest: vi.fn(),
  rejectOptimizationRequest: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

const metricsPlaceholderMocks = vi.hoisted(() => ({
  PLACEHOLDER_CONSTRAINT_METRIC_INPUT: {
    totalEquityWeight: 90,
    tppWeight: 9,
    tppUserMin: 5,
    tppUserMax: 15,
    stockCount: 22,
    stockCountUserMin: 16,
    stockCountUserMax: 30,
    maxSingleStockWeight: 7,
    maxSectorConcentration: 20,
  },
  PLACEHOLDER_CURRENT_RISK_METRICS: {
    beta: 1,
    volatility: 18,
    maxDrawdown: -20,
    downsideDeviation: 12,
    trackingError: 3,
    sharpeRatio: 0.9,
    calmarRatio: 0.4,
    informationRatio: 0.3,
    alpha: 1,
  },
  PLACEHOLDER_PROPOSED_RISK_METRICS: {
    beta: 0.9,
    volatility: 16,
    maxDrawdown: -18,
    downsideDeviation: 10,
    trackingError: 2.5,
    sharpeRatio: 1.1,
    calmarRatio: 0.5,
    informationRatio: 0.4,
    alpha: 1.5,
  },
}))

vi.mock(
  "@/features/optimization/lib/optimizationMetricsPlaceholder",
  () => metricsPlaceholderMocks,
)

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
  startedAt: null,
  completedAt: "2026-08-07T09:00:00",
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:00:00",
} as const

describe("useOptimizationResultReview", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizationRequest
      .mockReset()
      .mockResolvedValue(COMPLETED_REQUEST)
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

  it("decide('approve') başarılı olduğunda decidedAs'ı 'approve' yapar", async () => {
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    const { result } = renderHook(() => useOptimizationResultReview(1))
    await waitFor(() => expect(result.current.isLoadingRequest).toBe(false))

    await act(async () => {
      await result.current.decide("approve")
    })

    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).toHaveBeenCalledWith(1)
    expect(result.current.decidedAs).toBe("approve")
    expect(result.current.isSubmitting).toBe(false)
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

    expect(result.current.constraintMetrics.length).toBe(5)
    expect(result.current.infoMetrics.length).toBe(9)
    expect(result.current.isApprovalBlocked).toBe(false)
  })

  it("kısıt metriği kırmızıysa isApprovalBlocked true olur ve decide('approve') no-op kalır", async () => {
    metricsPlaceholderMocks.PLACEHOLDER_CONSTRAINT_METRIC_INPUT.maxSectorConcentration = 40

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

    metricsPlaceholderMocks.PLACEHOLDER_CONSTRAINT_METRIC_INPUT.maxSectorConcentration = 20
  })
})
