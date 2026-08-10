import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

export const UNKNOWN_RATIONALE_SECTOR_LABEL = "Sektör Bilgisi Yok"

export function sortRationaleAssetsBySector(
  assets: OptimizationResultAsset[],
): OptimizationResultAsset[] {
  return [...assets].sort((a, b) =>
    (a.sectorName ?? UNKNOWN_RATIONALE_SECTOR_LABEL).localeCompare(
      b.sectorName ?? UNKNOWN_RATIONALE_SECTOR_LABEL,
      "tr-TR",
    ),
  )
}
