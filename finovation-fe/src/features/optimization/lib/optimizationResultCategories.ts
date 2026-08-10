import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

export type ResultCategoryKey =
  | "ALL"
  | "INCREASED"
  | "DECREASED"
  | "ADDED"
  | "REMOVED"
  | "LOCKED"
  | "UNCHANGED"

export type ResultCategory = {
  key: ResultCategoryKey
  label: string
  count: number
}

const WEIGHT_EPSILON = 0.001

function isAdded(asset: OptimizationResultAsset): boolean {
  return asset.currentWeight <= WEIGHT_EPSILON && asset.proposedWeight > WEIGHT_EPSILON
}

function isRemoved(asset: OptimizationResultAsset): boolean {
  return asset.currentWeight > WEIGHT_EPSILON && asset.proposedWeight <= WEIGHT_EPSILON
}

function getRoundedDelta(asset: OptimizationResultAsset): number {
  const effectiveWeight = asset.finalWeight ?? asset.proposedWeight
  return Math.round(effectiveWeight) - Math.round(asset.currentWeight)
}

function isLocked(asset: OptimizationResultAsset): boolean {
  return asset.actionType === "KEEP"
}

export function matchesCategory(
  asset: OptimizationResultAsset,
  category: ResultCategoryKey,
): boolean {
  switch (category) {
    case "ALL":
      return true
    case "ADDED":
      return isAdded(asset)
    case "REMOVED":
      return isRemoved(asset)
    case "INCREASED":
      return (
        !isAdded(asset) &&
        !isRemoved(asset) &&
        !isLocked(asset) &&
        getRoundedDelta(asset) > 0
      )
    case "DECREASED":
      return (
        !isAdded(asset) &&
        !isRemoved(asset) &&
        !isLocked(asset) &&
        getRoundedDelta(asset) < 0
      )
    case "LOCKED":
      return !isAdded(asset) && !isRemoved(asset) && isLocked(asset)
    case "UNCHANGED":
      return (
        !isAdded(asset) &&
        !isRemoved(asset) &&
        !isLocked(asset) &&
        getRoundedDelta(asset) === 0
      )
  }
}

export function buildResultCategories(
  assets: OptimizationResultAsset[],
): ResultCategory[] {
  const definitions: { key: ResultCategoryKey; label: string }[] = [
    { key: "ALL", label: "Tümü" },
    { key: "INCREASED", label: "Artırılanlar" },
    { key: "DECREASED", label: "Azaltılanlar" },
    { key: "ADDED", label: "Yeni Eklenenler" },
    { key: "REMOVED", label: "Çıkarılanlar" },
    { key: "LOCKED", label: "Sabit Kalanlar" },
    { key: "UNCHANGED", label: "Değişmeyenler" },
  ]

  return definitions.map((definition) => ({
    ...definition,
    count: assets.filter((asset) => matchesCategory(asset, definition.key))
      .length,
  }))
}
