import {
  fetchOptimizationRequest,
  fetchOptimizationResult,
} from "@/features/optimization/api/optimizationApi"
import { buildConstraintMetricInput } from "@/features/optimization/lib/optimizationConstraintMetricInput"
import { buildCriteriaRows } from "@/features/optimization/lib/optimizationCriteriaRows"
import {
  evaluateConstraintMetrics,
  evaluateInfoMetrics,
} from "@/features/optimization/lib/optimizationMetricsEvaluation"
import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import type { OptimizationPdfExportInput } from "@/features/optimization/lib/optimizationPdfExport"
import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"

export async function loadOptimizationResultExportInput(
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

  const criteriaRows = buildCriteriaRows(
    assets,
    constraintMetrics,
    infoMetrics,
    request.tppMinWeight,
    request.tppMaxWeight,
    request.stockCountMin,
    request.stockCountMax,
  )

  return {
    fundName,
    request,
    assets,
    criteriaRows,
  }
}
