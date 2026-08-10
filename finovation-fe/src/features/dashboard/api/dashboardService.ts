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
  funds: z.array(fundSummaryResponseSchema),
  drafts: z.array(fundDraftSummarySchema),
  optimizationLogs: z.array(optimizationLogEntryResponseSchema),
  latestOptimizationResult: optimizationResultSchema.nullable(),
  stressTests: z.array(stressTestHistoryResponseSchema),
})

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

  return {
    data: {
      funds: response.funds.map(toFundOption),
      drafts: response.drafts,
      optimizationLogs: response.optimizationLogs,
      latestOptimizationResult: response.latestOptimizationResult,
      stressTests: response.stressTests,
    },
    errors: {
      funds: "",
      drafts: "",
      optimization: "",
      stressTests: "",
    },
  }
}

export function loadFundPerformance(fundId: string, signal?: AbortSignal) {
  return fetchFundMonitoring(fundId, signal)
}
