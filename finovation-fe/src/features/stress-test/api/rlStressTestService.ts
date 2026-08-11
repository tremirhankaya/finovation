import {
    getRlStressTestCompatibilityUrl,
    getRlStressTestDetailUrl,
    getRlStressTestHistoryUrl,
    getRlStressTestsUrl,
    getRlStressTestDeleteUrl,
} from "@/shared/api/apiConfig"
import { apiFetch, apiSend } from "@/shared/api/httpClient"

import type {
    RlInferenceResponse,
    RlStressTestDetailResponse,
    RlStressTestHistoryItem,
    RunRlStressTestRequest,
} from "@/features/stress-test/model/rlStressTest.types"

export type RlPortfolioCompatibilityResponse = {
    compatible: boolean
    message: string
}

export async function checkRlPortfolioCompatibility(
    fundId: string,
    signal?: AbortSignal,
): Promise<RlPortfolioCompatibilityResponse> {
    return apiFetch(
        getRlStressTestCompatibilityUrl(fundId),
        {
            errorMessage: "RL portföy uygunluğu kontrol edilemedi",
            signal,
        },
    )
}

export async function runRlStressTest(
    request: RunRlStressTestRequest,
): Promise<RlInferenceResponse> {
    return apiFetch(
        getRlStressTestsUrl(),
        {
            method: "POST",
            body: request,
            errorMessage: "RL stres testi çalıştırılamadı",
        },
    )
}
export async function fetchRlStressTestHistory(
    signal?: AbortSignal,
): Promise<RlStressTestHistoryItem[]> {
    return apiFetch(
        getRlStressTestHistoryUrl(),
        {
            errorMessage: "RL analiz geçmişi yüklenemedi",
            signal,
        },
    )
}

export async function fetchRlStressTestDetail(
    testId: string,
    signal?: AbortSignal,
): Promise<RlStressTestDetailResponse> {
    return apiFetch(
        getRlStressTestDetailUrl(testId),
        {
            errorMessage: "RL analiz detayı yüklenemedi",
            signal,
        },
    )
}
export function mapRlStressTestDetailToInference(
    detail: RlStressTestDetailResponse,
): RlInferenceResponse {
    return {
        model: detail.model,
        scenario: detail.scenarioCode,
        scenario_start_date: detail.scenarioStartDate,
        scenario_end_date: detail.scenarioEndDate,
        trading_day_count: detail.tradingDayCount,
        initial_nav: detail.initialNav,

        days: detail.days.map((day) => ({
            day_number: day.dayNumber,
            date: day.date,
            total_new_nav: day.rlNav,
            passive_nav: day.passiveNav,
            weights: day.weights,
        })),

        final_nav: detail.finalNav,
        return_pct: detail.returnPct,
        passive_final_nav: detail.passiveFinalNav,
        passive_return_pct: detail.passiveReturnPct,
        outperformance_amount: detail.outperformanceAmount,
        outperformance_pct: detail.outperformancePct,
        total_commission: detail.totalCommission,
    }
}
export async function deleteRlStressTest(
    testId: string,
): Promise<void> {
    await apiSend(
        getRlStressTestDeleteUrl(testId),
        {
            method: "DELETE",
            errorMessage: "RL analizi silinemedi",
        },
    )
}