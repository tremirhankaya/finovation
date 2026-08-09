import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

export type ResultCategoryKey =
  | "ALL"
  | "INCREASED"
  | "DECREASED"
  | "ADDED"
  | "REMOVED"
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
      return asset.actionType === "INCREASE" && !isAdded(asset)
    case "DECREASED":
      return asset.actionType === "DECREASE" && !isRemoved(asset)
    case "UNCHANGED":
      return asset.actionType === "KEEP"
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
    { key: "UNCHANGED", label: "Değişmeyenler" },
  ]

  return definitions.map((definition) => ({
    ...definition,
    count: assets.filter((asset) => matchesCategory(asset, definition.key))
      .length,
  }))
}
