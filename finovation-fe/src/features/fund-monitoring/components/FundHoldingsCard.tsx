import type { FundPosition } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundHoldingsCardProps = {
  positions: FundPosition[]
}

export default function FundHoldingsCard({ positions }: FundHoldingsCardProps) {
  const largestWeight = Math.max(
    ...positions.map((position) => position.weightPercentage),
    1,
  )

  return (
    <section className={styles.card}>
      <div className={styles.cardHeadingRow}>
        <h2 className={styles.cardTitle}>Tüm Varlıklar</h2>
        <span>{positions.length} kalem</span>
      </div>

      <div className={styles.holdingsTable} role="table">
        <div className={styles.holdingsHead} role="row">
          <span role="columnheader">Varlık</span>
          <span role="columnheader">Sektör</span>
          <span role="columnheader">Ağırlık</span>
        </div>

        {positions.length === 0 ? (
          <div className={styles.emptyList} role="row">
            Fon seçildiğinde portföy varlıkları burada listelenecek.
          </div>
        ) : (
          positions.map((position) => (
            <div
              className={styles.holdingRow}
              role="row"
              key={position.assetId}
            >
              <div role="cell">
                <strong>{position.symbol}</strong>
                <span>{position.name}</span>
                <div className={styles.weightTrack} aria-hidden="true">
                  <div
                    className={styles.weightFill}
                    style={{
                      width: `${(position.weightPercentage / largestWeight) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span role="cell">
                {position.sectorName ?? "Sınıflandırılmamış"}
              </span>
              <strong role="cell">
                %
                {position.weightPercentage.toLocaleString("tr-TR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
