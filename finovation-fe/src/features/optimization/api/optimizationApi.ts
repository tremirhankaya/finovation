import {
  getInvestmentUniverseUrl,
  getOptimizationRequestApproveUrl,
  getOptimizationRequestRejectUrl,
  getOptimizationRequestRunUrl,
  getOptimizationRequestUrl,
  getOptimizationRequestsUrl,
} from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import {
  type CreateOptimizationRequestPayload,
  type InvestmentUniverseAssetResponse,
  type OptimizationRequestResponse,
  investmentUniverseResponseSchema,
  optimizationRequestListResponseSchema,
  optimizationRequestResponseSchema,
} from "@/features/optimization/model/optimizationSchemas"

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

export async function approveOptimizationRequest(
  requestId: number,
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestApproveUrl(requestId),
    {
      method: "POST",
      errorMessage: "Optimizasyon sonucu onaylanamadı",
    },
    optimizationRequestResponseSchema.parse,
  )
}

export async function rejectOptimizationRequest(
  requestId: number,
): Promise<OptimizationRequestResponse> {
  return apiFetch(
    getOptimizationRequestRejectUrl(requestId),
    {
      method: "POST",
      errorMessage: "Optimizasyon sonucu reddedilemedi",
    },
    optimizationRequestResponseSchema.parse,
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
