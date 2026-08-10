import type { ComplianceRow } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

const DOT_CLASS_NAMES: Record<ComplianceRow["status"], string> = {
  UYUMLU: styles.complianceDotUYUMLU,
  DIKKAT: styles.complianceDotDIKKAT,
  UYUMSUZ: styles.complianceDotUYUMSUZ,
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
      aria-label="İzahname ve Kural Kontrolü"
    >
      <div className={styles.complianceHeader}>
        <h2 className={styles.compliancePanelTitle}>
          İzahname ve Kural Kontrolü
        </h2>
        <span
          className={styles.complianceInfoIcon}
          title="Girdileriniz değiştikçe anlık güncellenir."
          aria-label="Girdileriniz değiştikçe anlık güncellenir."
        >
          i
        </span>
      </div>

      <ul className={styles.complianceRowList}>
        {rows.map((row) => (
          <li key={row.key} className={styles.complianceRow}>
            <span
              className={`${styles.complianceDot} ${row.locked ? styles.complianceDotLocked : DOT_CLASS_NAMES[row.status]}`}
              aria-hidden="true"
            />
            <div className={styles.complianceRowBody}>
              <span className={styles.complianceRowLabel}>{row.label}</span>
              <span className={styles.complianceRowDetail}>{row.detail}</span>
              {row.locked && (
                <span className={styles.complianceLockedTag}>
                  Kısıt (Değiştirilemez)
                </span>
              )}
            </div>
            <span className={styles.complianceRowDash} aria-hidden="true">
              —
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.complianceLegend}>
        <h3 className={styles.complianceLegendTitle}>Durum</h3>
        <ul className={styles.complianceLegendList}>
          <li>
            <span
              className={`${styles.complianceDot} ${styles.complianceDotUYUMLU}`}
              aria-hidden="true"
            />
            Yeşil: Kendi Kriterinize ve İzahnameye Uygun
          </li>
          <li>
            <span
              className={`${styles.complianceDot} ${styles.complianceDotDIKKAT}`}
              aria-hidden="true"
            />
            Turuncu: Yalnızca İzahnameye Uygun
          </li>
          <li>
            <span
              className={`${styles.complianceDot} ${styles.complianceDotUYUMSUZ}`}
              aria-hidden="true"
            />
            Kırmızı: İzahnameye Uygun Değil
          </li>
          <li>
            <span
              className={`${styles.complianceDot} ${styles.complianceDotLocked}`}
              aria-hidden="true"
            />
            Gri: Bilgi / Kısıt (Değiştirilemez)
          </li>
        </ul>
      </div>

      <p className={styles.complianceFooterNote}>
        Kısıtlar fon izahnamesine göre kontrol edilmektedir.
      </p>

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
