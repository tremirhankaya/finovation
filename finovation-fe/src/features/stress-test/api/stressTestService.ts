import {getFundsUrl, getStressScenariosUrl, getStressTestsUrl, getStressTestUrl,
} from "@/shared/api/apiConfig"
import { apiFetch, apiSend } from "@/shared/api/httpClient"
import type { RunStressTestRequest } from "@/features/stress-test/model/stressTest.types"
import {
    type RunStressTestResponse,
    type StressScenarioResponse,
    type StressTestDetailResponse,
    type StressTestHistoryResponse,
    type StressTestFundResponse,
    runStressTestResponseSchema,
    stressScenarioListResponseSchema,
    stressTestDetailResponseSchema,
    stressTestHistoryListResponseSchema,
    stressTestFundListResponseSchema,
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