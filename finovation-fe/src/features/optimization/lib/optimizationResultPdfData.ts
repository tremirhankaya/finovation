import {
  fetchOptimizationRequest,
  fetchOptimizationResult,
} from "@/features/optimization/api/optimizationApi"
import { buildConstraintMetricInput } from "@/features/optimization/lib/optimizationConstraintMetricInput"
import {
  evaluateConstraintMetrics,
  evaluateInfoMetrics,
} from "@/features/optimization/lib/optimizationMetricsEvaluation"
import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import type { OptimizationPdfExportInput } from "@/features/optimization/lib/optimizationPdfExport"
import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"

export async function loadOptimizationResultPdfInput(
  requestId: number,
  fundName: string,
): Promise<OptimizationPdfExportInput> {
  const [request, result] = await Promise.all([
    fetchOptimizationRequest(requestId),
    fetchOptimizationResult(requestId),
  ])

  const assets = result.assets
  const constraintMetrics = evaluateConstraintMetrics(
    buildConstraintMetricInput(
      assets,
      request.tppMinWeight,
      request.tppMaxWeight,
      request.stockCountMin,
      request.stockCountMax,
    ),
  )
  const riskProfile: RiskProfile = request.riskProfile ?? "BALANCED"
  const { current, proposed } = buildRiskMetricsSnapshots(result.metrics)
  const infoMetrics = evaluateInfoMetrics(current, proposed, riskProfile)

  return {
    fundName,
    request,
    assets,
    summary: {
      increasedCount: assets.filter((asset) => asset.actionType === "INCREASE")
        .length,
      decreasedCount: assets.filter((asset) => asset.actionType === "DECREASE")
        .length,
      keptCount: assets.filter((asset) => asset.actionType === "KEEP").length,
      overriddenCount: assets.filter((asset) => asset.manuallyOverridden)
        .length,
    },
    constraintMetrics,
    infoMetrics,
  }
}
