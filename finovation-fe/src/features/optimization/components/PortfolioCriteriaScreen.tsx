import { Fragment, useMemo, useState } from "react"

import {
  CRITERIA_STATUS_LABELS,
  formatCriteriaDelta,
  formatCriteriaValue,
  type CriteriaRow,
} from "@/features/optimization/lib/optimizationCriteriaRows"
import { sortRationaleAssetsBySector } from "@/features/optimization/lib/optimizationRationaleSectors"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

function rationaleDotClass(
  actionType: OptimizationResultAsset["actionType"],
): string {
  if (actionType === "INCREASE") return styles.rationaleDotUp
  if (actionType === "DECREASE") return styles.rationaleDotDown
  return styles.rationaleDotFlat
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
  const [expandedAssetCodes, setExpandedAssetCodes] = useState<Set<string>>(
    new Set(),
  )

  const toggleRationaleCard = (assetCode: string) => {
    setExpandedAssetCodes((current) => {
      const next = new Set(current)
      if (next.has(assetCode)) {
        next.delete(assetCode)
      } else {
        next.add(assetCode)
      }
      return next
    })
  }

  const sortedRationaleAssets = useMemo(
    () => sortRationaleAssetsBySector(rationaleAssets),
    [rationaleAssets],
  )

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

        <table className={`${styles.comparisonTable} ${styles.criteriaTable}`}>
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
            {rows.map((row, index) => {
              const delta = formatCriteriaDelta(
                row.currentValue,
                row.proposedValue,
                row.unit,
              )
              const isFirstMetricRow =
                row.unit === "RATIO" && rows[index - 1]?.unit !== "RATIO"

              return (
                <Fragment key={row.key}>
                  {isFirstMetricRow && (
                    <tr className={styles.criteriaSectionDivider}>
                      <td colSpan={5}>Risk ve Getiri Metrikleri</td>
                    </tr>
                  )}
                  <tr>
                    <td>{row.label}</td>
                    <td>{formatCriteriaValue(row.currentValue, row.unit)}</td>
                    <td>
                      <strong>
                        {formatCriteriaValue(row.proposedValue, row.unit)}
                      </strong>
                    </td>
                    <td className={styles[`metricStatus${row.status}`]}>
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
                          {CRITERIA_STATUS_LABELS[row.status]}
                        </span>
                      </span>
                      <p className={styles.criteriaStatusDetail}>
                        {row.detail}
                      </p>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </section>

      {sortedRationaleAssets.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelEyebrow}>
            <span className={styles.panelEyebrowDot} aria-hidden="true" />
            Model Gerekçeleri
          </h2>
          <div className={styles.rationaleGrid}>
            {sortedRationaleAssets.map((asset) => {
              const isExpanded = expandedAssetCodes.has(asset.assetCode)
              return (
                <div
                  key={asset.assetCode}
                  className={`${styles.rationaleCard} ${isExpanded ? styles.rationaleCardExpanded : ""}`}
                >
                  <div className={styles.rationaleCardHeader}>
                    <span className={styles.rationaleCardName}>
                      <span
                        className={`${styles.rationaleDot} ${rationaleDotClass(asset.actionType)}`}
                        aria-hidden="true"
                      />
                      {asset.assetCode}
                    </span>
                    <button
                      type="button"
                      className={styles.rationaleCardToggle}
                      onClick={() => toggleRationaleCard(asset.assetCode)}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `${asset.assetCode} gerekçesini gizle`
                          : `${asset.assetCode} gerekçesini göster`
                      }
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>
                  {isExpanded && (
                    <p className={styles.rationaleCardText}>
                      {asset.rationale}
                    </p>
                  )}
                </div>
              )
            })}
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
