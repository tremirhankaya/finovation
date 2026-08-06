import { useMemo, useState } from "react"
import { useNavigate } from "react-router"

import FundComparisonCard from "@/features/fund-monitoring/components/FundComparisonCard"
import FundHoldingsCard from "@/features/fund-monitoring/components/FundHoldingsCard"
import FundMetricsCard from "@/features/fund-monitoring/components/FundMetricsCard"
import FundPriceCard from "@/features/fund-monitoring/components/FundPriceCard"
import SectorAllocationCard from "@/features/fund-monitoring/components/SectorAllocationCard"
import { useFundMonitoring } from "@/features/fund-monitoring/hooks/useFundMonitoring"
import type {
  FundMonitoringSnapshot,
  FundOption,
  PricePeriod,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"
import Logo from "@/shared/ui/Logo"

export type FundMonitoringViewProps = {
  funds: FundOption[]
  selectedFundId: string
  snapshot: FundMonitoringSnapshot | null
  isLoading?: boolean
  errorMessage?: string
  onFundChange?: (fundId: string) => void
  onRetry?: () => void
  onBack?: () => void
}

export function FundMonitoringView({
  funds,
  selectedFundId,
  snapshot,
  isLoading = false,
  errorMessage,
  onFundChange,
  onRetry,
  onBack,
}: FundMonitoringViewProps) {
  const [period, setPeriod] = useState<PricePeriod>("1M")
  const hasFund = funds.length > 0
  const comparisonAssets = useMemo(
    () =>
      snapshot
        ? (snapshot.comparisonAssets ?? [
            {
              id: snapshot.fund.id,
              code: snapshot.fund.name.slice(0, 5).toLocaleUpperCase("tr-TR"),
              name: snapshot.fund.name,
              color: "#0d9488",
              isFund: true,
              returns: Object.fromEntries(
                snapshot.periodReturns.map((item) => [item.period, item.value]),
              ),
            },
          ])
        : [],
    [snapshot],
  )

  return (
    <main className={styles.page} aria-busy={isLoading}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brandBlock}>
            <Logo variant="dark" size="small" />
            <div className={styles.titleBlock}>
              <h1>Fon İzleme ve Performans</h1>
              <p>Portföy analiz paneli</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <label className={styles.fundSelect}>
              <span>İzlenen fon</span>
              <select
                value={selectedFundId}
                disabled={!hasFund || isLoading}
                onChange={(event) => onFundChange?.(event.target.value)}
              >
                {!hasFund && (
                  <option value="">Henüz bir fon oluşturmadınız</option>
                )}
                {funds.map((fund) => (
                  <option value={fund.id} key={fund.id}>
                    {fund.name} — {fund.type}
                  </option>
                ))}
              </select>
            </label>
            {onBack && (
              <button
                className={styles.backButton}
                type="button"
                onClick={onBack}
              >
                Dashboard'a dön
              </button>
            )}
          </div>
        </header>

        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            <div>
              <strong>Veriler alınamadı</strong>
              <span>{errorMessage}</span>
            </div>
            {onRetry && (
              <button type="button" onClick={onRetry}>
                Tekrar dene
              </button>
            )}
          </div>
        )}

        {!hasFund && !errorMessage && (
          <div className={styles.infoBanner} role="status">
            <span className={styles.infoIcon} aria-hidden="true">
              i
            </span>
            <div>
              <strong>İzlenecek aktif fon bulunmuyor</strong>
              <span>
                Fon oluşturulduğunda pay fiyatı, teknik göstergeler ve portföy
                dağılımı bu ekranda görüntülenecek.
              </span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className={styles.loadingBanner} role="status">
            Fon verileri yükleniyor…
          </div>
        )}

        <div className={styles.topGrid}>
          <FundPriceCard
            snapshot={snapshot}
            period={period}
            onPeriodChange={setPeriod}
          />
          <FundMetricsCard
            indicators={snapshot?.technicalIndicators}
            periodReturns={snapshot?.periodReturns}
          />
        </div>

        <div className={styles.bottomGrid}>
          <FundHoldingsCard positions={snapshot?.positions ?? []} />
          <SectorAllocationCard
            allocations={snapshot?.sectorAllocations ?? []}
          />
        </div>

        <FundComparisonCard assets={comparisonAssets} />
      </div>
    </main>
  )
}

export default function FundMonitoringPage() {
  const navigate = useNavigate()
  const {
    funds,
    selectedFundId,
    snapshot,
    isLoading,
    errorMessage,
    selectFund,
    reload,
  } = useFundMonitoring()

  return (
    <FundMonitoringView
      funds={funds}
      selectedFundId={selectedFundId}
      snapshot={snapshot}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onFundChange={selectFund}
      onRetry={reload}
      onBack={() => navigate("/dashboard")}
    />
  )
}
