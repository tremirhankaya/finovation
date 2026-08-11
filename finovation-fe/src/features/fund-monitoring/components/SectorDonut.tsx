import type { SectorAllocation } from "@/features/fund-monitoring/model/fundMonitoring.types"
import DonutChart from "@/shared/ui/DonutChart"

type SectorDonutProps = {
  allocations: SectorAllocation[]
}

export const SECTOR_COLORS = [
  "#0e8f76",
  "#4a90d9",
  "#e0a458",
  "#8b7cf0",
  "#e26d8a",
  "#45b7c8",
  "#6bcb77",
  "#c77dff",
  "#f4c15d",
  "#5c8a9e",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#a16207",
  "#ef4444",
  "#0891b2",
] as const

function formatSectorWeight(value: number): string {
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}`
}

export default function SectorDonut({ allocations }: SectorDonutProps) {
  return (
    <DonutChart
      slices={allocations.map((allocation, index) => ({
        id: allocation.sectorId,
        label: allocation.sectorName,
        value: allocation.weightPercentage,
        color: SECTOR_COLORS[index % SECTOR_COLORS.length],
      }))}
      ariaLabel={
        allocations.length > 0
          ? "Seçili fonun sektörel ağırlık dağılımı"
          : "Fon seçilmediği için sektörel dağılım verisi bulunmuyor"
      }
      formatValue={formatSectorWeight}
    />
  )
}
