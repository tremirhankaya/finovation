import { Link } from "react-router"

import DashboardIcon from "@/features/dashboard/components/DashboardIcon"
import { REQUEST_STATUS_LABELS } from "@/features/optimization/lib/optimizationExportLabels"
import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import type { OptimizationResult } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationLogEntry } from "@/features/optimization/model/optimizationSchemas"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatMetric(value: number | null, unit: "percent" | "ratio") {
  if (value === null) return "—"
  return unit === "percent"
    ? `%${numberFormatter.format(value)}`
    : numberFormatter.format(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
}

type OptimizationOverviewProps = {
  logs: OptimizationLogEntry[]
  result: OptimizationResult | null
  isLoading: boolean
  errorMessage: string
}

export default function OptimizationOverview({
  logs,
  result,
  isLoading,
  errorMessage,
}: OptimizationOverviewProps) {
  const resultLog = logs.find((log) => log.resultAvailable)
  const latestLog = resultLog ?? logs[0]
  const snapshots = result ? buildRiskMetricsSnapshots(result.metrics) : null
  const metrics = [
    {
      label: "Volatilite",
      current: snapshots?.current.volatility ?? null,
      proposed: snapshots?.proposed.volatility ?? null,
      unit: "percent" as const,
    },
    {
      label: "Maksimum Düşüş",
      current: snapshots?.current.maxDrawdown ?? null,
      proposed: snapshots?.proposed.maxDrawdown ?? null,
      unit: "percent" as const,
    },
    {
      label: "Sharpe Oranı",
      current: snapshots?.current.sharpeRatio ?? null,
      proposed: snapshots?.proposed.sharpeRatio ?? null,
      unit: "ratio" as const,
    },
  ]

  return (
    <section className={`${styles.panel} ${styles.optimizationPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>Optimizasyon</span>
          <h2>Son optimizasyon sonucu</h2>
        </div>
        <span className={styles.panelHeaderIcon}>
          <DashboardIcon name="optimization" />
        </span>
      </div>

      {isLoading ? (
        <div className={styles.compactLoading} role="status">
          Optimizasyon özeti yükleniyor…
        </div>
      ) : errorMessage && logs.length === 0 ? (
        <div className={styles.compactError} role="alert">
          {errorMessage}
        </div>
      ) : !latestLog ? (
        <div className={styles.compactEmpty}>
          <strong>Henüz optimizasyon yapılmadı</strong>
          <p>
            Aktif bir fon için ilk optimizasyon senaryonuzu oluşturabilirsiniz.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.optimizationMeta}>
            <div>
              <strong>{latestLog.fundName}</strong>
              <span>
                {formatDate(latestLog.completedAt ?? latestLog.updatedAt)}
              </span>
            </div>
            <span
              className={`${styles.statusBadge} ${styles[`status${latestLog.status}`]}`}
            >
              {REQUEST_STATUS_LABELS[latestLog.status] ?? latestLog.status}
            </span>
          </div>

          {result ? (
            <div className={styles.metricComparison}>
              <div className={styles.metricHeader}>
                <span>Metrik</span>
                <span>Mevcut</span>
                <span>Önerilen</span>
              </div>
              {metrics.map((metric) => (
                <div className={styles.metricRow} key={metric.label}>
                  <span>{metric.label}</span>
                  <span>{formatMetric(metric.current, metric.unit)}</span>
                  <strong>{formatMetric(metric.proposed, metric.unit)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.resultUnavailable}>
              {errorMessage ||
                "Bu işlem için görüntülenebilir bir sonuç bulunmuyor."}
            </p>
          )}
        </>
      )}

      <div className={styles.panelFooter}>
        <Link to="/optimization-requests/logs">İşlem geçmişi</Link>
        <Link
          to={
            resultLog
              ? `/optimization-requests/${resultLog.requestId}/result`
              : "/optimization-requests/new"
          }
          state={resultLog ? { fundName: resultLog.fundName } : undefined}
        >
          {resultLog ? "Sonucu incele" : "Optimizasyon başlat"}{" "}
          <DashboardIcon name="arrow" />
        </Link>
      </div>
    </section>
  )
}
