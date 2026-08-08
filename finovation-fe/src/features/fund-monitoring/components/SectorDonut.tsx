import { useState } from "react"

import type { SectorAllocation } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type SectorDonutProps = {
  allocations: SectorAllocation[]
}

export const SECTOR_COLORS = [
  "#0d9488",
  "#14b8a6",
  "#2dd4bf",
  "#5eead4",
  "#0f766e",
  "#134e4a",
  "#94a3b8",
] as const

const RADIUS = 58
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function formatSectorWeight(value: number): string {
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}`
}

export default function SectorDonut({ allocations }: SectorDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const total = allocations.reduce(
    (sum, allocation) => sum + allocation.weightPercentage,
    0,
  )
  const activeAllocation =
    activeIndex === null ? null : allocations[activeIndex]
  let consumed = 0

  return (
    <div className={styles.donutChart}>
      <svg
        viewBox="0 0 160 160"
        role="img"
        aria-label={
          allocations.length > 0
            ? "Seçili fonun sektörel ağırlık dağılımı"
            : "Fon seçilmediği için sektörel dağılım verisi bulunmuyor"
        }
      >
        <circle
          cx="80"
          cy="80"
          r={RADIUS}
          fill="none"
          stroke="#e8eef4"
          strokeWidth="23"
        />
        {total > 0 &&
          allocations.map((allocation, index) => {
            const fraction = allocation.weightPercentage / total
            const length = fraction * CIRCUMFERENCE
            const offset = -consumed * CIRCUMFERENCE
            consumed += fraction
            const label = `${allocation.sectorName}: ${formatSectorWeight(
              allocation.weightPercentage,
            )}`

            return (
              <circle
                key={allocation.sectorId}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                stroke={SECTOR_COLORS[index % SECTOR_COLORS.length]}
                strokeWidth={activeIndex === index ? "27" : "23"}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform="rotate(-90 80 80)"
                tabIndex={0}
                aria-label={label}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
            )
          })}
      </svg>

      {activeAllocation && (
        <div
          className={styles.sectorHoverDetail}
          role="status"
          aria-live="polite"
        >
          <strong>{activeAllocation.sectorName}</strong>
          <span>{formatSectorWeight(activeAllocation.weightPercentage)}</span>
        </div>
      )}
    </div>
  )
}
