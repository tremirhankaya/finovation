import type { PortfolioRiskMetricsSnapshot } from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultMetric } from "@/features/optimization/model/optimizationResultSchemas"

const METRIC_KEY_TO_FIELD: Record<string, keyof PortfolioRiskMetricsSnapshot> = {
  BETA: "beta",
  VOLATILITY: "volatility",
  MAX_DRAWDOWN: "maxDrawdown",
  DOWNSIDE_DEVIATION: "downsideDeviation",
  TRACKING_ERROR: "trackingError",
  SHARPE_RATIO: "sharpeRatio",
  CALMAR_RATIO: "calmarRatio",
  INFORMATION_RATIO: "informationRatio",
  ALPHA: "alpha",
}

function emptySnapshot(): PortfolioRiskMetricsSnapshot {
  return {
    beta: null,
    volatility: null,
    maxDrawdown: null,
    downsideDeviation: null,
    trackingError: null,
    sharpeRatio: null,
    calmarRatio: null,
    informationRatio: null,
    alpha: null,
  }
}

export type RiskMetricsSnapshots = {
  current: PortfolioRiskMetricsSnapshot
  proposed: PortfolioRiskMetricsSnapshot
}

export function buildRiskMetricsSnapshots(
  metrics: OptimizationResultMetric[],
): RiskMetricsSnapshots {
  const current = emptySnapshot()
  const proposed = emptySnapshot()

  for (const metric of metrics) {
    const field = METRIC_KEY_TO_FIELD[metric.key]
    if (!field) continue
    current[field] = metric.currentValue
    proposed[field] = metric.proposedValue
  }

  return { current, proposed }
}
