import {
  formatIndicatorValue,
  indicatorToneClass,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type { TechnicalIndicator } from "@/features/fund-monitoring/model/fundMonitoring.types"
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
    label: "Maksimum Düşüş (Yıllık)",
    value: null,
    unit: "PERCENT",
  },
  {
    code: "TRACKING_ERROR",
    label: "Tracking Error (Yıllık)",
    value: null,
    unit: "PERCENT",
  },
  {
    code: "CALMAR",
    label: "Calmar Oranı (Yıllık)",
    value: null,
    unit: "RATIO",
  },
  {
    code: "INFORMATION_RATIO",
    label: "Information Ratio (Yıllık)",
    value: null,
    unit: "RATIO",
  },
  {
    code: "LIQUIDITY_RATIO",
    label: "Likidite Oranı",
    value: null,
    unit: "PERCENT",
  },
  { code: "BETA", label: "Beta (Yıllık)", value: null, unit: "RATIO" },
  {
    code: "DOWNSIDE_DEVIATION",
    label: "Downside Deviation (Yıllık)",
    value: null,
    unit: "PERCENT",
  },
  {
    code: "SORTINO",
    label: "Sortino Oranı (Yıllık)",
    value: null,
    unit: "RATIO",
  },
  {
    code: "SHARPE",
    label: "Sharpe Oranı (Yıllık)",
    value: null,
    unit: "RATIO",
  },
  { code: "ALPHA", label: "Alpha (Yıllık)", value: null, unit: "PERCENT" },
]

type FundMetricsCardProps = {
  indicators?: TechnicalIndicator[]
}

export default function FundMetricsCard({
  indicators = EMPTY_INDICATORS,
}: FundMetricsCardProps) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Teknik Göstergeler</h2>
      <dl className={styles.indicatorList}>
        {indicators.map((indicator) => {
          const descriptionId = `indicator-${indicator.code.toLowerCase()}-description`

          return (
            <div className={styles.indicatorRow} key={indicator.code}>
              <dt className={styles.indicatorLabel}>
                {indicator.description && (
                  <span className={styles.indicatorHelp}>
                    <button
                      type="button"
                      aria-label={`${indicator.label} açıklaması`}
                      aria-describedby={descriptionId}
                    >
                      i
                    </button>
                    <span id={descriptionId} role="tooltip">
                      {indicator.description}
                    </span>
                  </span>
                )}
                <span>{indicator.label}</span>
              </dt>
              <dd className={styles[indicatorToneClass(indicator)]}>
                {formatIndicatorValue(indicator.value, indicator.unit)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
