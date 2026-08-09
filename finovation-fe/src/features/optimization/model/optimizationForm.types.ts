export type UniverseAsset = {
  assetCode: string
  symbol: string
  name: string
  sectorName: string | null
}

export type OptimizableFund = {
  id: string
  name: string
  typeLabel: string
  active: boolean
  lastOptimizationDate: string | null
  stockCount: number
  sectorCount: number
  equityWeightPercent: number
  tppWeightPercent: number
}

export type AssetSelectionType = "KEEP" | "EXCLUDE" | "FORCE_ADD"

export type AssetSelectionMap = Partial<Record<string, AssetSelectionType>>

export type ComplianceRowStatus = "UYUMLU" | "DIKKAT" | "UYUMSUZ"

export type ComplianceRow = {
  key: string
  label: string
  status: ComplianceRowStatus
  detail: string
}
