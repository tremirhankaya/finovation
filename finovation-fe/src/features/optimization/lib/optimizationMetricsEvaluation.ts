import * as thresholds from "@/features/optimization/lib/optimizationMetricsThresholdsPendingBusinessApproval"
import type {
  ConstraintMetric,
  ConstraintMetricInput,
  ConstraintMetricStatus,
  InfoMetric,
  InfoMetricStatus,
  PortfolioRiskMetricsSnapshot,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"

const CANNOT_EVALUATE_DETAIL = "Kontrol Edilemedi — gerekli veri yok"

function statusForUserRangeValue(
  value: number | null,
  userMin: number,
  userMax: number,
  prospectusMin: number,
  prospectusMax: number,
): ConstraintMetricStatus {
  if (value == null) return "GRAY"
  if (value < prospectusMin || value > prospectusMax) return "RED"
  if (value >= userMin && value <= userMax) return "GREEN"
  return "AMBER"
}

function statusForTotalEquityWeight(
  value: number | null,
): ConstraintMetricStatus {
  if (value == null) return "GRAY"
  if (
    value < thresholds.PROSPECTUS_TOTAL_EQUITY_WEIGHT_MIN ||
    value > thresholds.PROSPECTUS_TOTAL_EQUITY_WEIGHT_MAX
  ) {
    return "RED"
  }
  if (
    value >= thresholds.PROPOSED_TOTAL_EQUITY_WEIGHT_GREEN_MIN &&
    value <= thresholds.PROPOSED_TOTAL_EQUITY_WEIGHT_GREEN_MAX
  ) {
    return "GREEN"
  }
  return "AMBER"
}

function statusForSingleStockWeight(
  value: number | null,
): ConstraintMetricStatus {
  if (value == null) return "GRAY"
  if (value > thresholds.PROSPECTUS_SINGLE_STOCK_MAX_WEIGHT) return "RED"
  if (
    value >=
    thresholds.PROSPECTUS_SINGLE_STOCK_MAX_WEIGHT -
      thresholds.PROPOSED_SINGLE_STOCK_AMBER_MARGIN_POINTS
  ) {
    return "AMBER"
  }
  return "GREEN"
}

function statusForSectorConcentration(
  value: number | null,
): ConstraintMetricStatus {
  if (value == null) return "GRAY"
  if (value > thresholds.PROSPECTUS_SECTOR_CONCENTRATION_MAX) return "RED"
  if (value > thresholds.PROPOSED_SECTOR_CONCENTRATION_GREEN_MAX) return "AMBER"
  return "GREEN"
}

export function evaluateConstraintMetrics(
  input: ConstraintMetricInput,
): ConstraintMetric[] {
  return [
    {
      key: "TOTAL_EQUITY_WEIGHT",
      label: "Toplam Hisse Ağırlığı",
      value: input.totalEquityWeight,
      status: statusForTotalEquityWeight(input.totalEquityWeight),
      detail:
        input.totalEquityWeight == null
          ? CANNOT_EVALUATE_DETAIL
          : "İzahname %85–%95, hedef bant %86–%94",
    },
    {
      key: "TPP_WEIGHT",
      label: "TPP Ağırlığı",
      value: input.tppWeight,
      status: statusForUserRangeValue(
        input.tppWeight,
        input.tppUserMin,
        input.tppUserMax,
        thresholds.PROSPECTUS_TPP_WEIGHT_MIN,
        thresholds.PROSPECTUS_TPP_WEIGHT_MAX,
      ),
      detail:
        input.tppWeight == null
          ? CANNOT_EVALUATE_DETAIL
          : `Seçtiğiniz aralık %${input.tppUserMin}–%${input.tppUserMax}, izahname %5–%15`,
    },
    {
      key: "STOCK_COUNT",
      label: "Hisse Sayısı",
      value: input.stockCount,
      status: statusForUserRangeValue(
        input.stockCount,
        input.stockCountUserMin,
        input.stockCountUserMax,
        thresholds.PROSPECTUS_STOCK_COUNT_MIN,
        thresholds.PROSPECTUS_STOCK_COUNT_MAX,
      ),
      detail:
        input.stockCount == null
          ? CANNOT_EVALUATE_DETAIL
          : `Seçtiğiniz aralık ${input.stockCountUserMin}–${input.stockCountUserMax}, sistem sınırı 16–30`,
    },
    {
      key: "MAX_SINGLE_STOCK_WEIGHT",
      label: "En Yüksek Tek Hisse Ağırlığı",
      value: input.maxSingleStockWeight,
      status: statusForSingleStockWeight(input.maxSingleStockWeight),
      detail:
        input.maxSingleStockWeight == null
          ? CANNOT_EVALUATE_DETAIL
          : "Üst limit %10",
    },
    {
      key: "MAX_SECTOR_CONCENTRATION",
      label: "En Yüksek Sektör Yoğunlaşması",
      value: input.maxSectorConcentration,
      status: statusForSectorConcentration(input.maxSectorConcentration),
      detail:
        input.maxSectorConcentration == null
          ? CANNOT_EVALUATE_DETAIL
          : "Üst limit %30",
    },
  ]
}

export function isApprovalBlockedByConstraints(
  constraintMetrics: ConstraintMetric[],
): boolean {
  return constraintMetrics.some((metric) => metric.status === "RED")
}

type InfoMetricEvaluation = {
  status: InfoMetricStatus
  detail: string
}

function evaluateRiskLevelMetric(
  currentValue: number | null,
  proposedValue: number | null,
  riskProfile: RiskProfile,
  sharpeImproved: boolean,
): InfoMetricEvaluation {
  if (currentValue == null || proposedValue == null) {
    return { status: "NEUTRAL", detail: "Hesaplanamadı" }
  }

  const delta = proposedValue - currentValue
  if (delta <= 0) {
    return { status: "GREEN", detail: "Azaldı" }
  }

  if (riskProfile === "AGGRESSIVE") {
    return sharpeImproved
      ? {
          status: "GREEN",
          detail: "Risk arttı; Agresif profilde olağan, Sharpe korunuyor",
        }
      : { status: "AMBER", detail: "Risk arttı ve Sharpe da düştü" }
  }

  const threshold =
    riskProfile === "CONSERVATIVE"
      ? thresholds.PROPOSED_CONSERVATIVE_RISK_INCREASE_THRESHOLD_POINTS
      : thresholds.PROPOSED_BALANCED_RISK_INCREASE_THRESHOLD_POINTS

  return delta > threshold
    ? {
        status: "AMBER",
        detail: `${delta.toFixed(2)} puan arttı (eşik ${threshold})`,
      }
    : {
        status: "GREEN",
        detail: `${delta.toFixed(2)} puan arttı, eşik altında`,
      }
}

function evaluateMaxDrawdownMetric(
  currentValue: number | null,
  proposedValue: number | null,
): InfoMetricEvaluation {
  if (currentValue == null || proposedValue == null) {
    return { status: "NEUTRAL", detail: "Hesaplanamadı" }
  }

  const deepenedBy = Math.abs(proposedValue) - Math.abs(currentValue)
  if (deepenedBy <= 0) {
    return { status: "GREEN", detail: "Sığlaştı" }
  }

  return deepenedBy > thresholds.PROPOSED_MAX_DRAWDOWN_AMBER_MARGIN_POINTS
    ? { status: "AMBER", detail: `${deepenedBy.toFixed(2)} puan derinleşti` }
    : {
        status: "GREEN",
        detail: `${deepenedBy.toFixed(2)} puan derinleşti, eşik altında`,
      }
}

function evaluateReturnQualityMetric(
  currentValue: number | null,
  proposedValue: number | null,
): InfoMetricEvaluation {
  if (currentValue == null || proposedValue == null) {
    return { status: "NEUTRAL", detail: "Hesaplanamadı" }
  }

  return proposedValue >= currentValue
    ? { status: "GREEN", detail: "Arttı" }
    : { status: "AMBER", detail: "Düştü" }
}

export function evaluateInfoMetrics(
  current: PortfolioRiskMetricsSnapshot,
  proposed: PortfolioRiskMetricsSnapshot,
  riskProfile: RiskProfile,
): InfoMetric[] {
  const sharpeImproved =
    current.sharpeRatio != null &&
    proposed.sharpeRatio != null &&
    proposed.sharpeRatio >= current.sharpeRatio

  const beta = evaluateRiskLevelMetric(
    current.beta,
    proposed.beta,
    riskProfile,
    sharpeImproved,
  )
  const volatility = evaluateRiskLevelMetric(
    current.volatility,
    proposed.volatility,
    riskProfile,
    sharpeImproved,
  )
  const downsideDeviation = evaluateRiskLevelMetric(
    current.downsideDeviation,
    proposed.downsideDeviation,
    riskProfile,
    sharpeImproved,
  )
  const maxDrawdown = evaluateMaxDrawdownMetric(
    current.maxDrawdown,
    proposed.maxDrawdown,
  )
  const sharpeRatio = evaluateReturnQualityMetric(
    current.sharpeRatio,
    proposed.sharpeRatio,
  )
  const calmarRatio = evaluateReturnQualityMetric(
    current.calmarRatio,
    proposed.calmarRatio,
  )
  const informationRatio = evaluateReturnQualityMetric(
    current.informationRatio,
    proposed.informationRatio,
  )
  const alpha = evaluateReturnQualityMetric(current.alpha, proposed.alpha)

  return [
    {
      key: "BETA",
      label: "Beta",
      currentValue: current.beta,
      proposedValue: proposed.beta,
      ...beta,
    },
    {
      key: "VOLATILITY",
      label: "Volatilite",
      currentValue: current.volatility,
      proposedValue: proposed.volatility,
      ...volatility,
    },
    {
      key: "MAX_DRAWDOWN",
      label: "Maksimum Düşüş",
      currentValue: current.maxDrawdown,
      proposedValue: proposed.maxDrawdown,
      ...maxDrawdown,
    },
    {
      key: "DOWNSIDE_DEVIATION",
      label: "Downside Deviation",
      currentValue: current.downsideDeviation,
      proposedValue: proposed.downsideDeviation,
      ...downsideDeviation,
    },
    {
      key: "TRACKING_ERROR",
      label: "Tracking Error",
      currentValue: current.trackingError,
      proposedValue: proposed.trackingError,
      status: "NEUTRAL",
      detail: "Amaca bağlı yorumlanır",
    },
    {
      key: "SHARPE_RATIO",
      label: "Sharpe Oranı",
      currentValue: current.sharpeRatio,
      proposedValue: proposed.sharpeRatio,
      ...sharpeRatio,
    },
    {
      key: "CALMAR_RATIO",
      label: "Calmar Oranı",
      currentValue: current.calmarRatio,
      proposedValue: proposed.calmarRatio,
      ...calmarRatio,
    },
    {
      key: "INFORMATION_RATIO",
      label: "Information Ratio",
      currentValue: current.informationRatio,
      proposedValue: proposed.informationRatio,
      ...informationRatio,
    },
    {
      key: "ALPHA",
      label: "Alfa",
      currentValue: current.alpha,
      proposedValue: proposed.alpha,
      ...alpha,
    },
  ]
}
