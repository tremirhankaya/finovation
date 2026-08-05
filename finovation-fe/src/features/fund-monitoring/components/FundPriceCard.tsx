import PriceTrendChart from "@/features/fund-monitoring/components/PriceTrendChart"
import {
  formatDataDate,
  formatPercentage,
  formatSharePrice,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import {
  PRICE_PERIODS,
  type FundMonitoringSnapshot,
  type PricePeriod,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundPriceCardProps = {
  snapshot: FundMonitoringSnapshot | null
  period: PricePeriod
  onPeriodChange: (period: PricePeriod) => void
}

export default function FundPriceCard({
  snapshot,
  period,
  onPeriodChange,
}: FundPriceCardProps) {
  const dailyChange = snapshot?.dailyChangePercentage ?? 0
  const isNegative = dailyChange < 0
  const points = snapshot?.priceHistory[period] ?? []

  return (
    <section className={`${styles.card} ${styles.priceCard}`}>
      <div className={styles.priceTop}>
        <div>
          <div className={styles.priceLabel}>
            <span
              className={snapshot ? styles.liveDot : styles.inactiveDot}
              aria-hidden="true"
            />
            Pay fiyatı · {snapshot?.fund.name ?? "Fon seçilmedi"}
          </div>
          <strong className={styles.priceValue}>
            {formatSharePrice(
              snapshot?.currentSharePrice ?? 0,
              snapshot?.currency ?? "TRY",
            )}
          </strong>
          <div
            className={`${styles.priceChange} ${
              isNegative ? styles.negativeChange : ""
            }`}
          >
            {isNegative ? "▼" : "▲"} {formatPercentage(dailyChange)} bugün
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
        <PriceTrendChart points={points} fundName={snapshot?.fund.name} />
      </div>
    </section>
  )
}
