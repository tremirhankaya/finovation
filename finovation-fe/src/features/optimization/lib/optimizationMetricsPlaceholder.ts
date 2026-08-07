import type {
  ConstraintMetricInput,
  PortfolioRiskMetricsSnapshot,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"

export const PLACEHOLDER_CONSTRAINT_METRIC_INPUT: ConstraintMetricInput = {
  totalEquityWeight: 91,
  tppWeight: 9,
  tppUserMin: 5,
  tppUserMax: 15,
  stockCount: 22,
  stockCountUserMin: 16,
  stockCountUserMax: 30,
  maxSingleStockWeight: 8.5,
  maxSectorConcentration: 24,
}

export const PLACEHOLDER_CURRENT_RISK_METRICS: PortfolioRiskMetricsSnapshot = {
  beta: 1.05,
  volatility: 18.2,
  maxDrawdown: -22.4,
  downsideDeviation: 12.1,
  trackingError: 3.4,
  sharpeRatio: 0.85,
  calmarRatio: 0.42,
  informationRatio: 0.31,
  alpha: 1.2,
}

export const PLACEHOLDER_PROPOSED_RISK_METRICS: PortfolioRiskMetricsSnapshot = {
  beta: 0.98,
  volatility: 16.7,
  maxDrawdown: -19.8,
  downsideDeviation: 10.9,
  trackingError: 2.9,
  sharpeRatio: 1.02,
  calmarRatio: 0.51,
  informationRatio: 0.44,
  alpha: 1.8,
}
