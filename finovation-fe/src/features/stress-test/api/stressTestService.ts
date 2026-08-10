import {
    getFundsUrl,
    getStressScenariosUrl,
    getStressTestAssetPathUrl,
    getStressTestPortfolioPathUrl,
    getStressTestRiskMetricsUrl,
    getStressTestSectorPathsUrl,
    getStressTestSectorsUrl,
    getStressTestsUrl,
    getStressTestUrl,
} from "@/shared/api/apiConfig"

import { apiFetch, apiSend } from "@/shared/api/httpClient"

import type { RunStressTestRequest } from "@/features/stress-test/model/stressTest.types"

import {
    type RunStressTestResponse,
    type StressScenarioResponse,
    type StressTestAssetPathResponse,
    type StressTestDetailResponse,
    type StressTestFundResponse,
    type StressTestHistoryResponse,
    type StressTestPortfolioPathResponse,
    type StressTestRiskMetricsResponse,
    type StressTestSectorImpactResponse,
    type StressTestSectorPathResponse,
    runStressTestResponseSchema,
    stressScenarioListResponseSchema,
    stressTestAssetPathResponseSchema,
    stressTestDetailResponseSchema,
    stressTestFundListResponseSchema,
    stressTestHistoryListResponseSchema,
    stressTestPortfolioPathResponseSchema,
    stressTestRiskMetricsResponseSchema,
    stressTestSectorImpactListResponseSchema,
    stressTestSectorPathListResponseSchema,
} from "@/features/stress-test/model/stressTestSchemas"

export async function fetchStressTestFunds(
    signal?: AbortSignal,
): Promise<StressTestFundResponse[]> {
    return apiFetch(
        getFundsUrl(),
        {
            errorMessage: "Fonlar yüklenemedi",
            signal,
        },
        stressTestFundListResponseSchema.parse,
    )
}

export async function fetchStressScenarios(
    signal?: AbortSignal,
): Promise<StressScenarioResponse[]> {
    return apiFetch(
        getStressScenariosUrl(),
        {
            errorMessage: "Stres senaryoları yüklenemedi",
            signal,
        },
        stressScenarioListResponseSchema.parse,
    )
}

export async function runStressTest(
    request: RunStressTestRequest,
): Promise<RunStressTestResponse> {
    return apiFetch(
        getStressTestsUrl(),
        {
            method: "POST",
            body: request,
            errorMessage: "Stres testi çalıştırılamadı",
        },
        runStressTestResponseSchema.parse,
    )
}

export async function fetchStressTestHistory(
    signal?: AbortSignal,
): Promise<StressTestHistoryResponse[]> {
    return apiFetch(
        getStressTestsUrl(),
        {
            errorMessage: "Stres testi geçmişi yüklenemedi",
            signal,
        },
        stressTestHistoryListResponseSchema.parse,
    )
}

export async function fetchStressTestDetail(
    testId: string,
    signal?: AbortSignal,
): Promise<StressTestDetailResponse> {
    return apiFetch(
        getStressTestUrl(testId),
        {
            errorMessage: "Stres testi detayı yüklenemedi",
            signal,
        },
        stressTestDetailResponseSchema.parse,
    )
}

export async function deleteStressTest(
    testId: string,
): Promise<void> {
    await apiSend(getStressTestUrl(testId), {
        method: "DELETE",
        errorMessage: "Stres testi silinemedi",
    })
}

export async function fetchStressTestAssetPath(
    testId: string,
    assetCode: string,
    signal?: AbortSignal,
): Promise<StressTestAssetPathResponse> {
    return apiFetch(
        getStressTestAssetPathUrl(testId, assetCode),
        {
            errorMessage: "Varlık stres yolu yüklenemedi",
            signal,
        },
        stressTestAssetPathResponseSchema.parse,
    )
}

export async function fetchStressTestSectors(
    testId: string,
    signal?: AbortSignal,
): Promise<StressTestSectorImpactResponse[]> {
    return apiFetch(
        getStressTestSectorsUrl(testId),
        {
            errorMessage: "Sektörel stres sonuçları yüklenemedi",
            signal,
        },
        stressTestSectorImpactListResponseSchema.parse,
    )
}

export async function fetchStressTestPortfolioPath(
    testId: string,
    signal?: AbortSignal,
): Promise<StressTestPortfolioPathResponse> {
    return apiFetch(
        getStressTestPortfolioPathUrl(testId),
        {
            errorMessage: "Portföy stres yolu yüklenemedi",
            signal,
        },
        stressTestPortfolioPathResponseSchema.parse,
    )
}

export async function fetchStressTestRiskMetrics(
    testId: string,
    signal?: AbortSignal,
): Promise<StressTestRiskMetricsResponse> {
    return apiFetch(
        getStressTestRiskMetricsUrl(testId),
        {
            errorMessage: "Risk metrikleri yüklenemedi",
            signal,
        },
        stressTestRiskMetricsResponseSchema.parse,
    )
}

export async function fetchStressTestSectorPaths(
    testId: string,
    signal?: AbortSignal,
): Promise<StressTestSectorPathResponse[]> {
    return apiFetch(
        getStressTestSectorPathsUrl(testId),
        {
            errorMessage: "Sektörel stres yolları yüklenemedi",
            signal,
        },
        stressTestSectorPathListResponseSchema.parse,
    )
}