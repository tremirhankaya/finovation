import type { ConstraintMetricInput } from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

const UNSPECIFIED_SECTOR_LABEL = "Diğer"

function effectiveWeight(asset: OptimizationResultAsset): number {
  return asset.finalWeight ?? asset.proposedWeight
}

export function buildConstraintMetricInput(
  assets: OptimizationResultAsset[],
  tppUserMin: number | null,
  tppUserMax: number | null,
  stockCountUserMin: number | null,
  stockCountUserMax: number | null,
  pickWeight: (asset: OptimizationResultAsset) => number = effectiveWeight,
): ConstraintMetricInput {
  const resolvedTppUserMin = tppUserMin ?? 0
  const resolvedTppUserMax = tppUserMax ?? 0
  const resolvedStockCountUserMin = stockCountUserMin ?? 0
  const resolvedStockCountUserMax = stockCountUserMax ?? 0

  if (assets.length === 0) {
    return {
      totalPortfolioWeight: null,
      totalEquityWeight: null,
      tppWeight: null,
      tppUserMin: resolvedTppUserMin,
      tppUserMax: resolvedTppUserMax,
      stockCount: null,
      stockCountUserMin: resolvedStockCountUserMin,
      stockCountUserMax: resolvedStockCountUserMax,
      maxSingleStockWeight: null,
      maxSectorConcentration: null,
    }
  }

  const heldEquities = assets.filter(
    (asset) => asset.assetType === "EQUITY" && pickWeight(asset) > 0,
  )
  const tppAsset = assets.find((asset) => asset.assetType === "TPP")

  const totalEquityWeight = heldEquities.reduce(
    (sum, asset) => sum + pickWeight(asset),
    0,
  )
  const maxSingleStockWeight = heldEquities.reduce(
    (max, asset) => Math.max(max, pickWeight(asset)),
    0,
  )

  const sectorTotals = new Map<string, number>()
  for (const asset of heldEquities) {
    const sector = asset.sectorName ?? UNSPECIFIED_SECTOR_LABEL
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + pickWeight(asset))
  }
  const maxSectorConcentration = Math.max(0, ...sectorTotals.values())
  const tppWeight = tppAsset ? pickWeight(tppAsset) : 0

  return {
    totalPortfolioWeight: totalEquityWeight + tppWeight,
    totalEquityWeight,
    tppWeight,
    tppUserMin: resolvedTppUserMin,
    tppUserMax: resolvedTppUserMax,
    stockCount: heldEquities.length,
    stockCountUserMin: resolvedStockCountUserMin,
    stockCountUserMax: resolvedStockCountUserMax,
    maxSingleStockWeight,
    maxSectorConcentration,
  }
}
