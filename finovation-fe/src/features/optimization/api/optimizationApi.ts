import {
  getInvestmentUniverseUrl,
  getOptimizableFundsUrl,
  getOptimizationFundPositionsUrl,
  getOptimizationLogsUrl,
  getOptimizationRequestApproveUrl,
  getOptimizationRequestRejectUrl,
  getOptimizationRequestResultUrl,
  getOptimizationRequestRunUrl,
  getOptimizationRequestUrl,
  getOptimizationRequestsUrl,
} from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import {
  type CreateOptimizationRequestPayload,
  type InvestmentUniverseAssetResponse,
  type OptimizableFundResponse,
  type OptimizationFundPositionsResponse,
  type OptimizationLogEntry,
  type OptimizationRequestResponse,
  investmentUniverseResponseSchema,
  optimizableFundListResponseSchema,
  optimizationFundPositionsResponseSchema,
  optimizationLogListResponseSchema,
  optimizationRequestListResponseSchema,
  optimizationRequestResponseSchema,
} from "@/features/optimization/model/optimizationSchemas"
import {
  type OptimizationResult,
  optimizationResultSchema,
} from "@/features/optimization/model/optimizationResultSchemas"

export async function fetchOptimizableFunds(
  signal?: AbortSignal,
): Promise<OptimizableFundResponse[]> {
  return apiFetch(
    getOptimizableFundsUrl(),
    {
      errorMessage: "Optimize edilebilir fonlar alınamadı",
      signal,
    },
    optimizableFundListResponseSchema.parse,
  )
}

export async function createOptimizationRequest(
  payload: CreateOptimizationRequestPayload,
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestsUrl(),
    {
      method: "POST",
      body: payload,
      errorMessage: "Optimizasyon senaryosu oluşturulamadı",
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function fetchOptimizationRequest(
  requestId: number,
  signal?: AbortSignal,
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestUrl(requestId),
    {
      errorMessage: "Optimizasyon isteği alınamadı",
      signal,
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function fetchOptimizationRequestsByFund(
  fundId: string,
  signal?: AbortSignal,
): Promise<OptimizationRequestResponse[]> {
  return apiFetch(
    getOptimizationRequestsUrl(fundId),
    {
      errorMessage: "Optimizasyon istekleri alınamadı",
      signal,
    },
    optimizationRequestListResponseSchema.parse,
  )
}

export async function runOptimizationRequest(
  requestId: number,
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestRunUrl(requestId),
    {
      method: "POST",
      errorMessage: "Optimizasyon çalıştırılamadı",
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function fetchOptimizationResult(
  requestId: number,
  signal?: AbortSignal,
): Promise<OptimizationResult> {
  return apiFetch(
    getOptimizationRequestResultUrl(requestId),
    {
      errorMessage: "Optimizasyon sonucu alınamadı",
      signal,
    },
    optimizationResultSchema.parse,
  )
}

export type AssetWeightOverride = {
  assetCode: string
  finalWeight: number
}

export async function approveOptimizationRequest(
  requestId: number,
  weightOverrides?: AssetWeightOverride[],
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestApproveUrl(requestId),
    {
      method: "POST",
      body:
        weightOverrides && weightOverrides.length > 0
          ? { weightOverrides }
          : undefined,
      errorMessage: "Optimizasyon sonucu onaylanamadı",
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function rejectOptimizationRequest(
  requestId: number,
  reason?: string,
): Promise<OptimizationRequestResponse> {
  const trimmedReason = reason?.trim()
  return apiFetch(
    getOptimizationRequestRejectUrl(requestId),
    {
      method: "POST",
      body: trimmedReason ? { reason: trimmedReason } : undefined,
      errorMessage: "Optimizasyon sonucu reddedilemedi",
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function fetchOptimizationLogs(
  signal?: AbortSignal,
): Promise<OptimizationLogEntry[]> {
  return apiFetch(
    getOptimizationLogsUrl(),
    {
      errorMessage: "İşlem logları alınamadı",
      signal,
    },
    optimizationLogListResponseSchema.parse,
  )
}

export async function fetchOptimizationFundPositions(
  fundId: string,
  signal?: AbortSignal,
): Promise<OptimizationFundPositionsResponse> {
  return apiFetch(
    getOptimizationFundPositionsUrl(fundId),
    {
      errorMessage: "Fonun mevcut pozisyonları alınamadı",
      signal,
    },
    optimizationFundPositionsResponseSchema.parse,
  )
}

export async function fetchInvestmentUniverse(
  signal?: AbortSignal,
): Promise<InvestmentUniverseAssetResponse[]> {
  return apiFetch(
    getInvestmentUniverseUrl(),
    {
      errorMessage: "Yatırım evreni alınamadı",
      signal,
    },
    investmentUniverseResponseSchema.parse,
  )
}
