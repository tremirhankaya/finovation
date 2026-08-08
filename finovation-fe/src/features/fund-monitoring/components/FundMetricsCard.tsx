import {
  formatIndicatorValue,
  formatPercentage,
  indicatorToneClass,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type {
  BenchmarkDefinition,
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

const EMPTY_RETURNS: PeriodReturn[] = [
  { period: "1M", label: "1 Aylık Getiri", value: null },
  { period: "3M", label: "3 Aylık Getiri", value: null },
  { period: "6M", label: "6 Aylık Getiri", value: null },
]

type FundMetricsCardProps = {
  benchmark?: BenchmarkDefinition
  indicators?: TechnicalIndicator[]
  periodReturns?: PeriodReturn[]
}

export default function FundMetricsCard({
  benchmark,
  indicators = EMPTY_INDICATORS,
  periodReturns = EMPTY_RETURNS,
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
                <span>{indicator.label}</span>
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
              </dt>
              <dd className={styles[indicatorToneClass(indicator)]}>
                {formatIndicatorValue(indicator.value, indicator.unit)}
              </dd>
            </div>
          )
        })}
      </dl>

      {benchmark && benchmark.components.length > 0 && (
        <section
          className={styles.benchmarkDefinition}
          aria-labelledby="benchmark-title"
        >
          <h3 id="benchmark-title">{benchmark.name}</h3>
          <ul>
            {benchmark.components.map((component) => (
              <li key={component.code}>
                <span>{component.name}</span>
                <strong>%{component.weightPercentage}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

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
