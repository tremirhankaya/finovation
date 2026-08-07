import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  approveOptimizationRequest,
  createOptimizationRequest,
  fetchOptimizationRequest,
  fetchOptimizationRequestsByFund,
  rejectOptimizationRequest,
  runOptimizationRequest,
} from "@/features/optimization/api/optimizationApi"

const sampleResponse = {
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
}

describe("optimizationApi", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
  })

  it("yeni senaryoyu POST /optimization-requests ile oluşturur", async () => {
    httpMocks.apiFetch.mockResolvedValue(sampleResponse)

    const payload = {
      fundId: 42,
      riskProfile: "BALANCED" as const,
      assetPreferences: [],
      tppMinWeight: 5,
      tppMaxWeight: 15,
      stockCountMin: 16,
      stockCountMax: 30,
    }

    await createOptimizationRequest(payload)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests",
      expect.objectContaining({
        method: "POST",
        body: payload,
        errorMessage: "Optimizasyon senaryosu oluşturulamadı",
      }),
      expect.any(Function),
    )
  })

  it("tek senaryoyu GET /optimization-requests/{id} ile alır", async () => {
    httpMocks.apiFetch.mockResolvedValue(sampleResponse)

    await fetchOptimizationRequest(1)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests/1",
      expect.objectContaining({
        errorMessage: "Optimizasyon isteği alınamadı",
      }),
      expect.any(Function),
    )
  })

  it("fona ait senaryoları GET ?fundId= ile listeler", async () => {
    httpMocks.apiFetch.mockResolvedValue([sampleResponse])

    await fetchOptimizationRequestsByFund("42")

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests?fundId=42",
      expect.objectContaining({
        errorMessage: "Optimizasyon istekleri alınamadı",
      }),
      expect.any(Function),
    )
  })

  it("senaryoyu POST /{id}/run ile çalıştırır", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      ...sampleResponse,
      status: "RUNNING",
    })

    await runOptimizationRequest(1)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests/1/run",
      expect.objectContaining({
        method: "POST",
        errorMessage: "Optimizasyon çalıştırılamadı",
      }),
      expect.any(Function),
    )
  })

  it("sonucu POST /{id}/approve ile onaylar", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      ...sampleResponse,
      status: "APPROVED",
    })

    await approveOptimizationRequest(1)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests/1/approve",
      expect.objectContaining({
        method: "POST",
        errorMessage: "Optimizasyon sonucu onaylanamadı",
      }),
      expect.any(Function),
    )
  })

  it("sonucu POST /{id}/reject ile reddeder", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      ...sampleResponse,
      status: "REJECTED",
    })

    await rejectOptimizationRequest(1)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/optimization-requests/1/reject",
      expect.objectContaining({
        method: "POST",
        errorMessage: "Optimizasyon sonucu reddedilemedi",
      }),
      expect.any(Function),
    )
  })
})
