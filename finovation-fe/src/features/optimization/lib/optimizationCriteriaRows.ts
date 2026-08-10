import { buildConstraintMetricInput } from "@/features/optimization/lib/optimizationConstraintMetricInput"
import type {
  ConstraintMetric,
  ConstraintMetricInput,
  InfoMetric,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

export type CriteriaRowStatus = "GREEN" | "AMBER" | "RED" | "NEUTRAL" | "GRAY"

export type CriteriaRow = {
  key: string
  label: string
  currentValue: number | null
  proposedValue: number | null
  status: CriteriaRowStatus
  detail: string
  unit: "PERCENT" | "COUNT" | "RATIO"
}

const CONSTRAINT_UNITS: Record<ConstraintMetric["key"], CriteriaRow["unit"]> = {
  TOTAL_PORTFOLIO_WEIGHT: "PERCENT",
  TOTAL_EQUITY_WEIGHT: "PERCENT",
  TPP_WEIGHT: "PERCENT",
  STOCK_COUNT: "COUNT",
  MAX_SINGLE_STOCK_WEIGHT: "PERCENT",
  MAX_SECTOR_CONCENTRATION: "PERCENT",
}

const CONSTRAINT_INPUT_KEYS: Record<
  ConstraintMetric["key"],
  keyof ConstraintMetricInput
> = {
  TOTAL_PORTFOLIO_WEIGHT: "totalPortfolioWeight",
  TOTAL_EQUITY_WEIGHT: "totalEquityWeight",
  TPP_WEIGHT: "tppWeight",
  STOCK_COUNT: "stockCount",
  MAX_SINGLE_STOCK_WEIGHT: "maxSingleStockWeight",
  MAX_SECTOR_CONCENTRATION: "maxSectorConcentration",
}

export function buildCriteriaRows(
  assets: OptimizationResultAsset[],
  constraintMetrics: ConstraintMetric[],
  infoMetrics: InfoMetric[],
  tppUserMin: number | null,
  tppUserMax: number | null,
  stockCountUserMin: number | null,
  stockCountUserMax: number | null,
): CriteriaRow[] {
  const currentInput = buildConstraintMetricInput(
    assets,
    tppUserMin,
    tppUserMax,
    stockCountUserMin,
    stockCountUserMax,
    (asset) => asset.currentWeight,
  )

  const constraintRows: CriteriaRow[] = constraintMetrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    currentValue: currentInput[CONSTRAINT_INPUT_KEYS[metric.key]],
    proposedValue: metric.value,
    status: metric.status,
    detail: metric.detail,
    unit: CONSTRAINT_UNITS[metric.key],
  }))

  const infoRows: CriteriaRow[] = infoMetrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    currentValue: metric.currentValue,
    proposedValue: metric.proposedValue,
    status: metric.status,
    detail: metric.detail,
    unit: "RATIO",
  }))

  return [...constraintRows, ...infoRows]
}
