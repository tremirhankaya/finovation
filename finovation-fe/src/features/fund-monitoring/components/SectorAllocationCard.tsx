import SectorDonut, {
  SECTOR_COLORS,
} from "@/features/fund-monitoring/components/SectorDonut"
import type { SectorAllocation } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type SectorAllocationCardProps = {
  allocations: SectorAllocation[]
}

export default function SectorAllocationCard({
  allocations,
}: SectorAllocationCardProps) {
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Sektörel Dağılım</h2>
      <div className={styles.donutWrap}>
        <SectorDonut allocations={allocations} />
      </div>

      {allocations.length === 0 ? (
        <p className={styles.emptySector}>
          Sektör dağılımı fon seçildikten sonra gösterilecek.
        </p>
      ) : (
        <ul className={styles.sectorLegend}>
          {allocations.map((allocation, index) => (
            <li key={allocation.sectorId}>
              <span
                className={styles.sectorSwatch}
                style={{
                  backgroundColor: SECTOR_COLORS[index % SECTOR_COLORS.length],
                }}
                aria-hidden="true"
              />
              <span>{allocation.sectorName}</span>
              <strong>
                %
                {allocation.weightPercentage.toLocaleString("tr-TR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
