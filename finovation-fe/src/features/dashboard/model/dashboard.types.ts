import type { FundDraftSummary } from "@/features/fund-design/api/fundDraftApi"
import type {
  FundMonitoringSnapshot,
  FundOption,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import type { OptimizationResult } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationLogEntry } from "@/features/optimization/model/optimizationSchemas"
import type { StressTestHistoryResponse } from "@/features/stress-test/model/stressTestSchemas"

export type DashboardOverviewData = {
  funds: FundOption[]
  drafts: FundDraftSummary[]
  optimizationLogs: OptimizationLogEntry[]
  latestOptimizationResult: OptimizationResult | null
  stressTests: StressTestHistoryResponse[]
}

export type DashboardSectionErrors = {
  funds: string
  drafts: string
  optimization: string
  stressTests: string
  monitoring: string
}

export type DashboardOverviewLoadResult = {
  data: DashboardOverviewData
  errors: Omit<DashboardSectionErrors, "monitoring">
}

export type DashboardViewModel = DashboardOverviewData & {
  selectedFundId: string
  monitoringSnapshot: FundMonitoringSnapshot | null
  errors: DashboardSectionErrors
  isOverviewLoading: boolean
  isMonitoringLoading: boolean
}
