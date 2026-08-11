export type ConstraintMetricStatus = "GREEN" | "AMBER" | "RED" | "GRAY"

export type ConstraintMetricKey = "TOTAL_PORTFOLIO_WEIGHT" | "TOTAL_EQUITY_WEIGHT" | "TPP_WEIGHT" | "STOCK_COUNT" | "MAX_SINGLE_STOCK_WEIGHT" | "MAX_SECTOR_CONCENTRATION"

export type ConstraintMetric = {
  key: ConstraintMetricKey
  label: string
  value: number | null
  status: ConstraintMetricStatus
  detail: string
}

export type InfoMetricStatus = "GREEN" | "AMBER" | "NEUTRAL"

export type InfoMetricKey = "BETA" | "VOLATILITY" | "MAX_DRAWDOWN" | "DOWNSIDE_DEVIATION" | "TRACKING_ERROR" | "SHARPE_RATIO" | "CALMAR_RATIO" | "INFORMATION_RATIO" | "ALPHA"

export type InfoMetric = {
  key: InfoMetricKey
  label: string
  currentValue: number | null
  proposedValue: number | null
  status: InfoMetricStatus
  detail: string
  description: string
}

export type PortfolioRiskMetricsSnapshot = {
  beta: number | null
  volatility: number | null
  maxDrawdown: number | null
  downsideDeviation: number | null
  trackingError: number | null
  sharpeRatio: number | null
  calmarRatio: number | null
  informationRatio: number | null
  alpha: number | null
}

export type ConstraintMetricInput = {
  totalPortfolioWeight: number | null
  totalEquityWeight: number | null
  tppWeight: number | null
  tppUserMin: number
  tppUserMax: number
  stockCount: number | null
  stockCountUserMin: number
  stockCountUserMax: number
  maxSingleStockWeight: number | null
  maxSectorConcentration: number | null
}
