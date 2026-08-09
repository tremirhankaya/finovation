import { useState } from "react"

import type { CriteriaRow } from "@/features/optimization/lib/optimizationCriteriaRows"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

function formatValue(value: number | null, unit: CriteriaRow["unit"]): string {
  if (value == null) return "—"
  if (unit === "PERCENT") return `%${value.toFixed(0)}`
  if (unit === "COUNT") return `${Math.round(value)}`
  return value.toFixed(2)
}

function formatDelta(
  currentValue: number | null,
  proposedValue: number | null,
  unit: CriteriaRow["unit"],
): { text: string; direction: "up" | "down" | "flat" } {
  if (currentValue == null || proposedValue == null) {
    return { text: "—", direction: "flat" }
  }
  const delta = proposedValue - currentValue
  const rounded = unit === "RATIO" ? delta : Math.round(delta)
  if (Math.abs(rounded) < (unit === "RATIO" ? 0.005 : 0.5)) {
    return { text: "—", direction: "flat" }
  }
  const formatted =
    unit === "PERCENT"
      ? `%${Math.abs(rounded).toFixed(0)}`
      : unit === "COUNT"
        ? `${Math.abs(rounded)}`
        : Math.abs(rounded).toFixed(2)
  return delta > 0
    ? { text: `+${formatted}`, direction: "up" }
    : { text: `-${formatted}`, direction: "down" }
}

const STATUS_LABELS: Record<CriteriaRow["status"], string> = {
  GREEN: "Uyumlu",
  AMBER: "Sınıra Yakın",
  RED: "İhlal Var",
  NEUTRAL: "Bilgi",
  GRAY: "Kontrol Edilemedi",
}

export type PortfolioCriteriaScreenProps = {
  fundName: string
  rows: CriteriaRow[]
  rationaleAssets: OptimizationResultAsset[]
  isApprovalBlocked: boolean
  isSubmitting: boolean
  submitErrorMessage: string
  onExportPdf: () => void
  isExportingPdf: boolean
  onExportExcel: () => void
  isExportingExcel: boolean
  onEditWeights: () => void
  onApprove: () => void
  onReject: () => void
}

export default function PortfolioCriteriaScreen({
  fundName,
  rows,
  rationaleAssets,
  isApprovalBlocked,
  isSubmitting,
  submitErrorMessage,
  onExportPdf,
  isExportingPdf,
  onExportExcel,
  isExportingExcel,
  onEditWeights,
  onApprove,
  onReject,
}: PortfolioCriteriaScreenProps) {
  const [confirmingReject, setConfirmingReject] = useState(false)

  return (
    <div className={styles.main}>
      <section className={styles.panel}>
        <div className={styles.comparisonHeader}>
          <div>
            <h2 className={styles.criteriaScreenTitle}>
              Portföy Kriterleri ve Model Gerekçeleri
            </h2>
            <p className={styles.panelDescription}>
              Mevcut ve optimize edilmiş {fundName} portföyünün yapısal
              karşılaştırması
            </p>
          </div>
          <div className={styles.criteriaExportButtons}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onExportPdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? "Hazırlanıyor…" : "↓ Analizi PDF Olarak İndir"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onExportExcel}
              disabled={isExportingExcel}
            >
              {isExportingExcel ? "Hazırlanıyor…" : "↓ Excel Olarak İndir"}
            </button>
          </div>
        </div>

        <p className={styles.panelEyebrow}>
          <span className={styles.panelEyebrowDot} aria-hidden="true" />
          Portföy Kriterleri Karşılaştırması
        </p>

        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Kriter</th>
              <th>Mevcut Fon</th>
              <th>Optimize Edilmiş</th>
              <th>Değişim</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const delta = formatDelta(
                row.currentValue,
                row.proposedValue,
                row.unit,
              )
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{formatValue(row.currentValue, row.unit)}</td>
                  <td>
                    <strong>{formatValue(row.proposedValue, row.unit)}</strong>
                  </td>
                  <td
                    className={
                      delta.direction === "up"
                        ? styles.changePositive
                        : delta.direction === "down"
                          ? styles.changeNegative
                          : undefined
                    }
                  >
                    {delta.text}
                  </td>
                  <td>
                    <span className={styles.criteriaStatusCell}>
                      <span
                        className={`${styles.metricDot} ${styles[`metricDot${row.status}`]}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`${styles.metricStatus} ${styles[`metricStatus${row.status}`]}`}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </span>
                    <p className={styles.criteriaStatusDetail}>{row.detail}</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {rationaleAssets.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelEyebrow}>
            <span className={styles.panelEyebrowDot} aria-hidden="true" />
            Model Gerekçeleri
          </h2>
          <div className={styles.rationaleGrid}>
            {rationaleAssets.map((asset) => (
              <div key={asset.assetCode} className={styles.rationaleCard}>
                <span className={styles.rationaleAssetCode}>
                  {asset.assetCode}
                </span>
                <p className={styles.rationaleText}>{asset.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isApprovalBlocked && (
        <div className={styles.errorBanner} role="alert">
          Kısıt metriklerinden en az biri kırmızı durumda, onaylayamazsınız.
          Ağırlıkları düzenleyip tekrar deneyin.
        </div>
      )}

      {submitErrorMessage && (
        <div className={styles.errorBanner} role="alert">
          {submitErrorMessage}
        </div>
      )}

      <div className={styles.criteriaActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onEditWeights}
          disabled={isSubmitting}
        >
          Ağırlıkları Düzenle
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onApprove}
          disabled={isSubmitting || isApprovalBlocked}
        >
          {isSubmitting ? "Gönderiliyor…" : "Portföyü Onayla ve Güncelle"}
        </button>
        {confirmingReject ? (
          <button
            type="button"
            className={styles.rejectButton}
            onClick={onReject}
            disabled={isSubmitting}
          >
            Emin misiniz? · İptal Etmek İçin Tıklayın
          </button>
        ) : (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setConfirmingReject(true)}
            disabled={isSubmitting}
          >
            Optimizasyonu İptal Et
          </button>
        )}
      </div>
    </div>
  )
}
