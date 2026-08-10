import type { OptimizableFundResponse } from "@/features/optimization/model/optimizationSchemas"
import type { OptimizableFund } from "@/features/optimization/model/optimizationForm.types"

const FUND_TYPE_LABELS: Record<OptimizableFundResponse["type"], string> = {
  EQUITY_INTENSIVE: "Hisse Senedi Yoğun Fon",
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}.${month}.${year}`
}

export function toOptimizableFund(
  response: OptimizableFundResponse,
): OptimizableFund {
  return {
    id: response.id,
    name: response.name,
    typeLabel: FUND_TYPE_LABELS[response.type],
    active: response.active,
    lastOptimizationDate: response.lastOptimizationDate
      ? formatDate(response.lastOptimizationDate)
      : null,
    lastOptimizationDateRaw: response.lastOptimizationDate,
    stockCount: response.stockCount,
    sectorCount: response.sectorCount,
    equityWeightPercent: response.equityWeightPercent,
    tppWeightPercent: response.tppWeightPercent,
  }
}
