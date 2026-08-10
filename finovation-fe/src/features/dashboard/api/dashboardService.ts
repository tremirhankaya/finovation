import { searchFundDrafts } from "@/features/fund-design/api/fundDraftApi"
import {
  fetchFundMonitoring,
  fetchFunds,
} from "@/features/fund-monitoring/api/fundMonitoringService"
import {
  fetchOptimizationLogs,
  fetchOptimizationResult,
} from "@/features/optimization/api/optimizationApi"
import { fetchStressTestHistory } from "@/features/stress-test/api/stressTestService"
import type { DashboardOverviewLoadResult } from "@/features/dashboard/model/dashboard.types"

const DRAFT_PREVIEW_SIZE = 10

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function compareIsoDescending(left: string, right: string): number {
  return right.localeCompare(left)
}

export async function loadDashboardOverview(
  signal?: AbortSignal,
): Promise<DashboardOverviewLoadResult> {
  const [fundsResult, draftsResult, optimizationResult, stressResult] =
    await Promise.allSettled([
      fetchFunds(signal),
      searchFundDrafts(
        { status: "IN_PROGRESS", size: DRAFT_PREVIEW_SIZE },
        signal,
      ),
      fetchOptimizationLogs(signal),
      fetchStressTestHistory(signal),
    ])

  const funds = fundsResult.status === "fulfilled" ? fundsResult.value : []
  const drafts =
    draftsResult.status === "fulfilled"
      ? [...draftsResult.value.content].sort((left, right) =>
          compareIsoDescending(left.updatedAt, right.updatedAt),
        )
      : []
  const optimizationLogs =
    optimizationResult.status === "fulfilled"
      ? [...optimizationResult.value].sort((left, right) =>
          compareIsoDescending(left.createdAt, right.createdAt),
        )
      : []
  const stressTests =
    stressResult.status === "fulfilled"
      ? [...stressResult.value].sort((left, right) =>
          compareIsoDescending(left.createdAt, right.createdAt),
        )
      : []

  let latestOptimizationResult = null
  let optimizationError =
    optimizationResult.status === "rejected"
      ? messageFor(optimizationResult.reason, "Optimizasyon özeti yüklenemedi.")
      : ""

  const latestResultLog = optimizationLogs.find((log) => log.resultAvailable)

  if (latestResultLog) {
    try {
      latestOptimizationResult = await fetchOptimizationResult(
        latestResultLog.requestId,
        signal,
      )
    } catch (error) {
      optimizationError = messageFor(
        error,
        "Son optimizasyon sonucu yüklenemedi.",
      )
    }
  }

  return {
    data: {
      funds,
      drafts,
      optimizationLogs,
      latestOptimizationResult,
      stressTests,
    },
    errors: {
      funds:
        fundsResult.status === "rejected"
          ? messageFor(fundsResult.reason, "Fonlar yüklenemedi.")
          : "",
      drafts:
        draftsResult.status === "rejected"
          ? messageFor(draftsResult.reason, "Fon taslakları yüklenemedi.")
          : "",
      optimization: optimizationError,
      stressTests:
        stressResult.status === "rejected"
          ? messageFor(stressResult.reason, "Stres testi özeti yüklenemedi.")
          : "",
    },
  }
}

export function loadFundPerformance(fundId: string, signal?: AbortSignal) {
  return fetchFundMonitoring(fundId, signal)
}
