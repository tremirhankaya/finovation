import { Link } from "react-router"

import DashboardIcon from "@/features/dashboard/components/DashboardIcon"
import PriceTrendChart from "@/features/fund-monitoring/components/PriceTrendChart"
import {
  formatDataDate,
  formatPercentage,
  formatSharePrice,
} from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type {
  FundMonitoringSnapshot,
  FundOption,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

type FundPerformanceOverviewProps = {
  funds: FundOption[]
  selectedFundId: string
  snapshot: FundMonitoringSnapshot | null
  isLoading: boolean
  errorMessage: string
  onFundChange: (fundId: string) => void
  onRetry: () => void
}

export default function FundPerformanceOverview({
  funds,
  selectedFundId,
  snapshot,
  isLoading,
  errorMessage,
  onFundChange,
  onRetry,
}: FundPerformanceOverviewProps) {
  const oneMonthReturn = snapshot?.periodReturns.find(
    (item) => item.period === "1M",
  )?.value
  const points = snapshot?.priceHistory["1M"] ?? []

  return (
    <section className={`${styles.panel} ${styles.performancePanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>Fon İzleme ve Performans</span>
          <h2>Fon performans görünümü</h2>
        </div>
        <label className={styles.fundSelect}>
          <span>İzlenen fon</span>
          <select
            aria-label="Dashboard izlenen fon"
            value={selectedFundId}
            disabled={funds.length === 0 || isLoading}
            onChange={(event) => onFundChange(event.target.value)}
          >
            {funds.length === 0 && <option value="">Aktif fon yok</option>}
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage ? (
        <div className={styles.sectionError} role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={onRetry}>
            Tekrar dene
          </button>
        </div>
      ) : funds.length === 0 && !isLoading ? (
        <div className={styles.sectionEmpty}>
          <span className={styles.emptyIcon}>
            <DashboardIcon name="performance" />
          </span>
          <strong>İzlenecek aktif fon bulunmuyor</strong>
          <p>
            İlk fonunuzu tamamladığınızda performans trendi burada görünecek.
          </p>
          <Link to="/fund-design/new">Yeni fon tasarla</Link>
        </div>
      ) : isLoading || !snapshot ? (
        <div className={styles.performanceLoading} role="status">
          <span className={styles.loadingPulse} />
          Fon performansı yükleniyor…
        </div>
      ) : (
        <>
          <div className={styles.performanceMetrics}>
            <div>
              <span>Güncel Pay Fiyatı</span>
              <strong>
                {formatSharePrice(
                  snapshot.currentSharePrice,
                  snapshot.currency,
                )}
              </strong>
              <small>{formatDataDate(snapshot.asOfDate)}</small>
            </div>
            <div>
              <span>Günlük Değişim</span>
              <strong
                className={
                  snapshot.dailyChangePercentage >= 0
                    ? styles.positiveValue
                    : styles.negativeValue
                }
              >
                {formatPercentage(snapshot.dailyChangePercentage)}
              </strong>
              <small>Önceki işlem gününe göre</small>
            </div>
            <div>
              <span>1 Aylık Getiri</span>
              <strong
                className={
                  oneMonthReturn != null && oneMonthReturn < 0
                    ? styles.negativeValue
                    : styles.positiveValue
                }
              >
                {formatPercentage(oneMonthReturn ?? null)}
              </strong>
              <small>Son bir aylık dönem</small>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <PriceTrendChart
              points={points}
              fundName={snapshot.fund.name}
              currency={snapshot.currency}
            />
          </div>
        </>
      )}

      <div className={styles.panelFooter}>
        <span>Detaylı metrikler, varlıklar ve karşılaştırmalar</span>
        <Link to="/fund-monitoring">
          Fon izlemeye git <DashboardIcon name="arrow" />
        </Link>
      </div>
    </section>
  )
}
