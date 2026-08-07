import type { FundPosition } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type KeptAssetsPanelProps = {
  positions: FundPosition[]
  keptAssetCodes: ReadonlySet<string>
  keptWeightSum: number
  onToggle: (assetCode: string) => void
}

export default function KeptAssetsPanel({
  positions,
  keptAssetCodes,
  keptWeightSum,
  onToggle,
}: KeptAssetsPanelProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        B · Optimizasyonda Korunacak Hisseler
      </h2>
      <p className={styles.panelDescription}>
        {keptAssetCodes.size} hisse sabitlendi · toplam %
        {keptWeightSum.toFixed(0)}. İşaretlenen hisse portföyde kalır ve mevcut
        ağırlığı sabit tutulur.
      </p>

      {positions.length === 0 ? (
        <p className={styles.emptyState}>
          Fonun mevcut pozisyon verisi bulunamadı.
        </p>
      ) : (
        <table className={styles.assetTable}>
          <thead>
            <tr>
              <th>Hisse</th>
              <th>Sektör</th>
              <th>Mevcut Ağırlık</th>
              <th>Koru</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.assetId}>
                <td>
                  {position.symbol} {position.name}
                </td>
                <td>{position.sectorName ?? "—"}</td>
                <td>%{position.weightPercentage}</td>
                <td>
                  <input
                    type="checkbox"
                    className={styles.assetCheckbox}
                    checked={keptAssetCodes.has(position.assetId)}
                    onChange={() => onToggle(position.assetId)}
                    aria-label={`${position.symbol} hissesini koru`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
