import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

const ACTION_LABELS: Record<OptimizationResultAsset["actionType"], string> = {
  INCREASE: "Artır",
  DECREASE: "Azalt",
  KEEP: "Koru",
}

const ACTION_CLASS_NAMES: Record<OptimizationResultAsset["actionType"], string> =
  {
    INCREASE: styles.actionBadgeINCREASE,
    DECREASE: styles.actionBadgeDECREASE,
    KEEP: styles.actionBadgeKEEP,
  }

function formatWeight(value: number): string {
  return `%${value.toFixed(1).replace(/\.0$/, "")}`
}

function formatChange(value: number): string {
  const formatted = formatWeight(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

export type AssetComparisonPanelProps = {
  assets: OptimizationResultAsset[]
  onFinalWeightChange: (assetCode: string, value: number) => void
  onResetFinalWeight: (assetCode: string) => void
}

export default function AssetComparisonPanel({
  assets,
  onFinalWeightChange,
  onResetFinalWeight,
}: AssetComparisonPanelProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        Varlık Bazlı Karşılaştırma
      </h2>
      <p className={styles.panelDescription}>
        Önerilen ağırlığı gerekirse Final Ağırlık kutusundan
        değiştirebilirsiniz; değişiklik "Manuel" olarak işaretlenir.
      </p>

      <table className={styles.comparisonTable}>
        <thead>
          <tr>
            <th>Hisse</th>
            <th>Mevcut</th>
            <th>Önerilen</th>
            <th>Final Ağırlık</th>
            <th>Değişim</th>
            <th>Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.assetCode}>
              <td>
                <span className={styles.assetName}>
                  {asset.assetCode} {asset.name}
                </span>
                <span className={styles.assetSector}>
                  {asset.sectorName ?? "—"}
                </span>
              </td>
              <td>{formatWeight(asset.currentWeight)}</td>
              <td>{formatWeight(asset.proposedWeight)}</td>
              <td>
                <div className={styles.finalWeightCell}>
                  <input
                    type="number"
                    step="0.1"
                    value={asset.finalWeight ?? asset.proposedWeight}
                    onChange={(event) =>
                      onFinalWeightChange(
                        asset.assetCode,
                        Number(event.target.value),
                      )
                    }
                    aria-label={`${asset.assetCode} final ağırlığı`}
                  />
                  {asset.manuallyOverridden && (
                    <button
                      type="button"
                      className={styles.resetOverrideButton}
                      onClick={() => onResetFinalWeight(asset.assetCode)}
                    >
                      Manuel · Sıfırla
                    </button>
                  )}
                </div>
              </td>
              <td
                className={
                  asset.changeAmount > 0
                    ? styles.changePositive
                    : asset.changeAmount < 0
                      ? styles.changeNegative
                      : undefined
                }
              >
                {formatChange(asset.changeAmount)}
              </td>
              <td>
                <span
                  className={`${styles.actionBadge} ${ACTION_CLASS_NAMES[asset.actionType]}`}
                >
                  {ACTION_LABELS[asset.actionType]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
