import { useState } from "react"

import PriceTrendChart from "@/features/fund-monitoring/components/PriceTrendChart"
import {
  formatDataDate,
  formatPercentage,
  formatSharePrice,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import {
  PRICE_PERIODS,
  type FundMonitoringSnapshot,
  type PeriodReturn,
  type PricePeriod,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundPriceCardProps = {
  snapshot: FundMonitoringSnapshot | null
  period: PricePeriod
  onPeriodChange: (period: PricePeriod) => void
}

const EMPTY_RETURNS: PeriodReturn[] = [
  { period: "1M", label: "1 Aylık Getiri", value: null },
  { period: "3M", label: "3 Aylık Getiri", value: null },
  { period: "6M", label: "6 Aylık Getiri", value: null },
  { period: "1Y", label: "1 Yıllık Getiri", value: null },
]

type ChartMode = "TRACKING" | "BACKTEST"

const indexFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 4,
})

export default function FundPriceCard({
  snapshot,
  period,
  onPeriodChange,
}: FundPriceCardProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("TRACKING")
  const isBacktest = chartMode === "BACKTEST"
  const dailyChange = isBacktest
    ? (snapshot?.backtestDailyChangePercentage ?? 0)
    : (snapshot?.dailyChangePercentage ?? 0)
  const isNegative = dailyChange < 0
  const isPositive = dailyChange > 0
  const points = isBacktest
    ? (snapshot?.backtestHistory[period] ?? [])
    : (snapshot?.priceHistory[period] ?? [])
  const periodReturns = snapshot?.periodReturns ?? EMPTY_RETURNS

  return (
    <section className={`${styles.card} ${styles.priceCard}`}>
      <div
        className={styles.chartTabs}
        role="tablist"
        aria-label="Grafik görünümü"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isBacktest}
          className={!isBacktest ? styles.activeChartTab : ""}
          onClick={() => setChartMode("TRACKING")}
        >
          Fon İzleme
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isBacktest}
          className={isBacktest ? styles.activeChartTab : ""}
          onClick={() => setChartMode("BACKTEST")}
        >
          Backtest
        </button>
      </div>
      <div className={styles.priceTop}>
        <div>
          <div className={styles.priceLabel}>
            <span
              className={snapshot ? styles.liveDot : styles.inactiveDot}
              aria-hidden="true"
            />
            {isBacktest ? "Backtest endeksi" : "Pay fiyatı"} ·{" "}
            {snapshot?.fund.name ?? "Fon seçilmedi"}
          </div>
          <strong className={styles.priceValue}>
            {isBacktest
              ? indexFormatter.format(snapshot?.backtestCurrentValue ?? 0)
              : formatSharePrice(
                  snapshot?.currentSharePrice ?? 0,
                  snapshot?.currency ?? "TRY",
                )}
          </strong>
          <div
            className={`${styles.priceChange} ${
              isNegative ? styles.negativeChange : ""
            }`}
          >
            {isNegative ? "▼" : isPositive ? "▲" : "•"}{" "}
            {formatPercentage(dailyChange)} bugün
          </div>
          <div className={styles.dataDate}>
            {formatDataDate(snapshot?.asOfDate)}
          </div>
        </div>

        <div className={styles.periods} aria-label="Pay fiyatı dönemi">
          {PRICE_PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={period === item.value}
              className={period === item.value ? styles.activePeriod : ""}
              onClick={() => onPeriodChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.priceChart}>
        <PriceTrendChart
          points={points}
          fundName={snapshot?.fund.name}
          currency={snapshot?.currency ?? "TRY"}
          valueMode={isBacktest ? "INDEX" : "PRICE"}
        />
      </div>

      <h3 className={styles.returnsTitle}>Backtest Getiri Özeti</h3>
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
