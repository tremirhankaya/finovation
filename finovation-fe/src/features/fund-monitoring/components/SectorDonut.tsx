import type { SectorAllocation } from "@/features/fund-monitoring/model/fundMonitoring.types"

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

export default function SectorDonut({ allocations }: SectorDonutProps) {
  const total = allocations.reduce(
    (sum, allocation) => sum + allocation.weightPercentage,
    0,
  )
  let consumed = 0

  return (
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

          return (
            <circle
              key={allocation.sectorId}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={SECTOR_COLORS[index % SECTOR_COLORS.length]}
              strokeWidth="23"
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={offset}
              transform="rotate(-90 80 80)"
            />
          )
        })}
      <text x="80" y="77" textAnchor="middle" fill="#64748b" fontSize="10">
        TOPLAM
      </text>
      <text
        x="80"
        y="96"
        textAnchor="middle"
        fill="#0f2d52"
        fontSize="16"
        fontWeight="700"
      >
        %{total.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
      </text>
    </svg>
  )
}
