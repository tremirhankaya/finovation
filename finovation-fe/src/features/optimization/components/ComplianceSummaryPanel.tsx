import type { ComplianceRow } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

const DOT_CLASS_NAMES: Record<ComplianceRow["status"], string> = {
  UYUMLU: styles.complianceDotUYUMLU,
  DIKKAT: styles.complianceDotDIKKAT,
  UYUMSUZ: styles.complianceDotUYUMSUZ,
}

const STATUS_CLASS_NAMES: Record<ComplianceRow["status"], string> = {
  UYUMLU: styles.complianceStatusUYUMLU,
  DIKKAT: styles.complianceStatusDIKKAT,
  UYUMSUZ: styles.complianceStatusUYUMSUZ,
}

export type ComplianceSummaryPanelProps = {
  rows: ComplianceRow[]
  onSubmit: () => void
  canSubmit: boolean
  isSubmitting: boolean
}

export default function ComplianceSummaryPanel({
  rows,
  onSubmit,
  canSubmit,
  isSubmitting,
}: ComplianceSummaryPanelProps) {
  return (
    <aside
      className={styles.compliancePanel}
      aria-label="İzahname uyumluluk paneli"
    >
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        İzahname Uyumluluk Paneli
      </h2>
      <p className={styles.complianceIntro}>
        Girdileriniz değiştikçe anlık güncellenir.
      </p>
      {rows.map((row) => (
        <div key={row.key} className={styles.complianceRow}>
          <div className={styles.complianceLabel}>
            <span className={styles.complianceLabelText}>
              <span
                className={`${styles.complianceDot} ${DOT_CLASS_NAMES[row.status]}`}
                aria-hidden="true"
              />
              {row.label}
            </span>
            <span className={STATUS_CLASS_NAMES[row.status]}>{row.status}</span>
          </div>
          <p className={styles.complianceDetail}>{row.detail}</p>
        </div>
      ))}
      <button
        type="button"
        className={styles.submitButton}
        onClick={onSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? "Gönderiliyor…" : "Optimizasyonu Çalıştır"}
      </button>
    </aside>
  )
}
