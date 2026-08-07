import type {
  ConstraintMetric,
  ConstraintMetricStatus,
  InfoMetric,
  InfoMetricStatus,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

function formatValue(value: number | null): string {
  if (value == null) return "—"
  return value.toFixed(1).replace(/\.0$/, "")
}

const STATUS_LABELS: Record<ConstraintMetricStatus | InfoMetricStatus, string> =
  {
    GREEN: "Uyumlu",
    AMBER: "Sınıra Yakın",
    RED: "İhlal Var",
    GRAY: "Kontrol Edilemedi",
    NEUTRAL: "Kontrol Edilemedi",
  }

export type MetricComplianceSummaryPanelProps = {
  constraintMetrics: ConstraintMetric[]
  infoMetrics: InfoMetric[]
}

export default function MetricComplianceSummaryPanel({
  constraintMetrics,
  infoMetrics,
}: MetricComplianceSummaryPanelProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        İzahname ve Risk Değerlendirmesi
      </h2>
      <div className={styles.draftNotice} role="note">
        Bu bölümdeki eşikler taslak — izahnamede tanımlı değil, iş birimi onayı
        bekliyor.
      </div>

      <p className={styles.metricGroupLabel}>Kısıt Metrikleri</p>
      {constraintMetrics.map((metric) => (
        <div key={metric.key} className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span className={styles.metricLabelText}>
              <span
                className={`${styles.metricDot} ${styles[`metricDot${metric.status}`]}`}
                aria-hidden="true"
              />
              {metric.label}
            </span>
            <span
              className={`${styles.metricStatus} ${styles[`metricStatus${metric.status}`]}`}
            >
              {STATUS_LABELS[metric.status]}
            </span>
          </div>
          <p className={styles.metricDetail}>
            {formatValue(metric.value)} · {metric.detail}
          </p>
        </div>
      ))}

      <p className={styles.metricGroupLabel}>Bilgi Metrikleri</p>
      {infoMetrics.map((metric) => (
        <div key={metric.key} className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span className={styles.metricLabelText}>
              <span
                className={`${styles.metricDot} ${styles[`metricDot${metric.status}`]}`}
                aria-hidden="true"
              />
              {metric.label}
            </span>
            <span
              className={`${styles.metricStatus} ${styles[`metricStatus${metric.status}`]}`}
            >
              {STATUS_LABELS[metric.status]}
            </span>
          </div>
          <p className={styles.metricDetail}>
            {metric.detail}
            {metric.currentValue != null && metric.proposedValue != null && (
              <span className={styles.metricValues}>
                {" "}
                ({formatValue(metric.currentValue)} →{" "}
                {formatValue(metric.proposedValue)})
              </span>
            )}
          </p>
        </div>
      ))}
    </section>
  )
}
