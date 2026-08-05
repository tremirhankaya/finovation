import {
  formatIndicatorValue,
  formatPercentage,
  indicatorToneClass,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type {
  PeriodReturn,
  TechnicalIndicator,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

const EMPTY_INDICATORS: TechnicalIndicator[] = [
  {
    code: "VOLATILITY",
    label: "Volatilite (Yıllık)",
    value: null,
    unit: "PERCENT",
  },
  {
    code: "MAX_DRAWDOWN",
    label: "Maksimum Düşüş",
    value: null,
    unit: "PERCENT",
  },
  { code: "BETA", label: "Beta", value: null, unit: "RATIO" },
  { code: "SHARPE", label: "Sharpe Oranı", value: null, unit: "RATIO" },
  {
    code: "SECTOR_CONCENTRATION",
    label: "Sektörel Yoğunluk",
    value: null,
    unit: "PERCENT",
  },
  {
    code: "LIQUIDITY_RATIO",
    label: "Likidite Oranı",
    value: null,
    unit: "PERCENT",
  },
]

const EMPTY_RETURNS: PeriodReturn[] = [
  { period: "1M", label: "1 Aylık Getiri", value: null },
  { period: "3M", label: "3 Aylık Getiri", value: null },
  { period: "6M", label: "6 Aylık Getiri", value: null },
]

type FundMetricsCardProps = {
  indicators?: TechnicalIndicator[]
  periodReturns?: PeriodReturn[]
}

export default function FundMetricsCard({
  indicators = EMPTY_INDICATORS,
  periodReturns = EMPTY_RETURNS,
}: FundMetricsCardProps) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Teknik Göstergeler</h2>
      <dl className={styles.indicatorList}>
        {indicators.map((indicator) => (
          <div className={styles.indicatorRow} key={indicator.code}>
            <dt>{indicator.label}</dt>
            <dd className={styles[indicatorToneClass(indicator)]}>
              {formatIndicatorValue(indicator.value, indicator.unit)}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className={styles.returnsTitle}>Getiri Özeti</h3>
      <div className={styles.returnsGrid}>
        {periodReturns.map((item) => (
          <div className={styles.returnTile} key={item.period}>
            <span>{item.label}</span>
            <strong
              className={
                item.value !== null && item.value < 0
                  ? styles.negative
                  : styles.positive
              }
            >
              {formatPercentage(item.value)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  )
}
