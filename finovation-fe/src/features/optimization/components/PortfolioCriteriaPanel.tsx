import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

export type PortfolioCriteriaSummary = {
  increasedCount: number
  decreasedCount: number
  keptCount: number
  overriddenCount: number
}

export type PortfolioCriteriaPanelProps = {
  assets: OptimizationResultAsset[]
  summary: PortfolioCriteriaSummary
}

export default function PortfolioCriteriaPanel({
  assets,
  summary,
}: PortfolioCriteriaPanelProps) {
  const rationales = assets.filter((asset) => asset.rationale)

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        Portföy Kriterleri ve Gerekçeler
      </h2>

      <div className={styles.criteriaSummaryRow}>
        <span>
          <strong>{summary.increasedCount}</strong> hisse artırıldı
        </span>
        <span>
          <strong>{summary.decreasedCount}</strong> hisse azaltıldı
        </span>
        <span>
          <strong>{summary.keptCount}</strong> hisse korundu
        </span>
        <span>
          <strong>{summary.overriddenCount}</strong> hisse manuel değiştirildi
        </span>
      </div>

      <ul className={styles.rationaleList}>
        {rationales.map((asset) => (
          <li key={asset.assetCode} className={styles.rationaleItem}>
            <span className={styles.rationaleAssetCode}>{asset.assetCode}</span>
            <p className={styles.rationaleText}>{asset.rationale}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
