import { Link } from "react-router"

import DashboardIcon from "@/features/dashboard/components/DashboardIcon"
import {
  formatStressDate,
  formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestHistoryResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

type StressTestOverviewProps = {
  test?: StressTestHistoryResponse
  isLoading: boolean
  errorMessage: string
}

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}

export default function StressTestOverview({
  test,
  isLoading,
  errorMessage,
}: StressTestOverviewProps) {
  const tone =
    !test || test.portfolioImpact === 0
      ? "neutral"
      : test.portfolioImpact > 0
        ? "positive"
        : "negative"
  const statusLabel =
    tone === "positive"
      ? "Pozitif etki"
      : tone === "negative"
        ? "Negatif etki"
        : "Nötr etki"

  return (
    <section className={`${styles.panel} ${styles.stressPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>Risk Görünümü</span>
          <h2>Son stres testi</h2>
        </div>
        <span className={styles.panelHeaderIcon}>
          <DashboardIcon name="stress" />
        </span>
      </div>

      {isLoading ? (
        <div className={styles.compactLoading} role="status">
          Stres testi özeti yükleniyor…
        </div>
      ) : errorMessage ? (
        <div className={styles.compactError} role="alert">
          {errorMessage}
        </div>
      ) : !test ? (
        <div className={styles.compactEmpty}>
          <strong>Henüz stres testi yok</strong>
          <p>Bir senaryo çalıştırarak fonunuzun olası piyasa etkisini ölçün.</p>
        </div>
      ) : (
        <>
          <div className={styles.stressHero}>
            <span
              className={`${styles.stressStatus} ${styles[`stressStatus${tone}`]}`}
            >
              <i /> {statusLabel}
            </span>
            <strong className={styles[`stressValue${tone}`]}>
              {formatStressPercentage(test.portfolioImpact)}
            </strong>
            <span>Toplam portföy etkisi</span>
          </div>

          <dl className={styles.detailList}>
            <div>
              <dt>Senaryo</dt>
              <dd>{test.scenarioName}</dd>
            </div>
            <div>
              <dt>Veri tarihi</dt>
              <dd>{formatStressDate(test.asOfDate)}</dd>
            </div>
            <div>
              <dt>Test zamanı</dt>
              <dd>{formatCreatedAt(test.createdAt)}</dd>
            </div>
          </dl>
        </>
      )}

      <div className={styles.panelFooter}>
        <span>Risk senaryolarını inceleyin</span>
        <Link to="/stress-test">
          Stres testine git <DashboardIcon name="arrow" />
        </Link>
      </div>
    </section>
  )
}
