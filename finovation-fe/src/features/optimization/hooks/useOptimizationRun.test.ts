import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  fetchOptimizationRequest: vi.fn(),
  runOptimizationRequest: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => apiMocks)

import { useOptimizationRun } from "@/features/optimization/hooks/useOptimizationRun"
import { ApiRequestError } from "@/shared/api/apiError"

const PREPARING_REQUEST = {
  id: 1,
  fundId: 42,
  dataTimestamp: null,
  modelVersion: null,
  requestedByUserId: 7,
  requestedByUsername: "fon-yoneticisi",
  riskProfile: "BALANCED",
  status: "PREPARING",
  startedAt: null,
  completedAt: null,
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:00:00",
} as const

describe("useOptimizationRun", () => {
  beforeEach(() => {
    apiMocks.fetchOptimizationRequest.mockReset()
    apiMocks.runOptimizationRequest.mockReset()
  })

  it("PREPARING durumundaki isteği otomatik çalıştırır", async () => {
    apiMocks.fetchOptimizationRequest.mockResolvedValue(PREPARING_REQUEST)
    apiMocks.runOptimizationRequest.mockResolvedValue({
      ...PREPARING_REQUEST,
      status: "COMPLETED",
    })

    const { result } = renderHook(() => useOptimizationRun(1))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(apiMocks.runOptimizationRequest).toHaveBeenCalledWith(1)
    expect(result.current.request?.status).toBe("COMPLETED")
    expect(result.current.errorMessage).toBe("")
  })

  it("zaten RUNNING/COMPLETED olan isteği tekrar çalıştırmaz", async () => {
    apiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...PREPARING_REQUEST,
      status: "COMPLETED",
    })

    const { result } = renderHook(() => useOptimizationRun(1))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(apiMocks.runOptimizationRequest).not.toHaveBeenCalled()
    expect(result.current.request?.status).toBe("COMPLETED")
  })

  it("motor bağlı olmadığında hata mesajını kullanıcı diline çevirir", async () => {
    apiMocks.fetchOptimizationRequest.mockResolvedValue(PREPARING_REQUEST)
    apiMocks.runOptimizationRequest.mockRejectedValue(
      new ApiRequestError(
        "Dış servisten hata döndü.",
        502,
        "EXTERNAL_SERVICE_ERROR",
      ),
    )

    const { result } = renderHook(() => useOptimizationRun(1))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.request).toBeNull()
    expect(result.current.errorMessage).toBe("Dış servisten hata döndü.")
  })

  it("retry çağrıldığında isteği yeniden yükleyip çalıştırır", async () => {
    apiMocks.fetchOptimizationRequest.mockResolvedValue(PREPARING_REQUEST)
    apiMocks.runOptimizationRequest
      .mockRejectedValueOnce(
        new ApiRequestError("Dış servisten hata döndü.", 502),
      )
      .mockResolvedValueOnce({ ...PREPARING_REQUEST, status: "COMPLETED" })

    const { result } = renderHook(() => useOptimizationRun(1))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.errorMessage).not.toBe("")

    act(() => result.current.retry())

    await waitFor(() =>
      expect(result.current.request?.status).toBe("COMPLETED"),
    )
    expect(apiMocks.runOptimizationRequest).toHaveBeenCalledTimes(2)
  })
})
