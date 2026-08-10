import { z } from "zod"

import { fundDraftSummarySchema } from "@/features/fund-design/model/fundDraftSchemas"
import {
  fetchFundMonitoring,
  toFundOption,
} from "@/features/fund-monitoring/api/fundMonitoringService"
import { fundSummaryResponseSchema } from "@/features/fund-monitoring/model/fundMonitoringSchemas"
import { optimizationResultSchema } from "@/features/optimization/model/optimizationResultSchemas"
import { optimizationLogEntryResponseSchema } from "@/features/optimization/model/optimizationSchemas"
import { stressTestHistoryResponseSchema } from "@/features/stress-test/model/stressTestSchemas"
import type { DashboardOverviewLoadResult } from "@/features/dashboard/model/dashboard.types"
import { getDashboardSummaryUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"

const dashboardSummaryResponseSchema = z.object({
  businessDate: z.iso.date(),
  funds: z.array(fundSummaryResponseSchema),
  drafts: z.array(fundDraftSummarySchema),
  optimizationLogs: z.array(optimizationLogEntryResponseSchema),
  latestOptimizationResult: optimizationResultSchema.nullable(),
  stressTests: z.array(stressTestHistoryResponseSchema),
  unavailableSections: z
    .array(z.enum(["FUNDS", "DRAFTS", "OPTIMIZATION", "STRESS_TESTS"]))
    .default([]),
})

const SECTION_ERROR_MESSAGES = {
  FUNDS: "Fon bilgileri yüklenemedi.",
  DRAFTS: "Taslak bilgileri yüklenemedi.",
  OPTIMIZATION: "Optimizasyon özeti yüklenemedi.",
  STRESS_TESTS: "Stres testi özeti yüklenemedi.",
} as const

export async function loadDashboardOverview(
  signal?: AbortSignal,
): Promise<DashboardOverviewLoadResult> {
  const response = await apiFetch(
    getDashboardSummaryUrl(),
    {
      errorMessage: "Dashboard özeti yüklenemedi",
      signal,
    },
    dashboardSummaryResponseSchema.parse,
  )
  const unavailableSections = new Set(response.unavailableSections)

  return {
    data: {
      businessDate: response.businessDate,
      funds: response.funds.map(toFundOption),
      drafts: response.drafts,
      optimizationLogs: response.optimizationLogs,
      latestOptimizationResult: response.latestOptimizationResult,
      stressTests: response.stressTests,
    },
    errors: {
      funds: unavailableSections.has("FUNDS")
        ? SECTION_ERROR_MESSAGES.FUNDS
        : "",
      drafts: unavailableSections.has("DRAFTS")
        ? SECTION_ERROR_MESSAGES.DRAFTS
        : "",
      optimization: unavailableSections.has("OPTIMIZATION")
        ? SECTION_ERROR_MESSAGES.OPTIMIZATION
        : "",
      stressTests: unavailableSections.has("STRESS_TESTS")
        ? SECTION_ERROR_MESSAGES.STRESS_TESTS
        : "",
    },
  }
}

export function loadFundPerformance(fundId: string, signal?: AbortSignal) {
  return fetchFundMonitoring(fundId, signal)
}
