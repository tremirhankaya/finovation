export type RulesFingerprintInput = {
  managementApproach?: string | null
  tppMinPct?: number | null
  tppMaxPct?: number | null
  preferredTppPct?: number | null
  minStockCount?: number | null
  maxStockCount?: number | null
  excludedAssetCodes?: string[] | null
  forcedAssetCodes?: string[] | null
}

export function buildRulesFingerprint(input: RulesFingerprintInput): string {
  const excluded = [...(input.excludedAssetCodes ?? [])].sort().join(",")
  const forced = [...(input.forcedAssetCodes ?? [])].sort().join(",")
  return [
    input.managementApproach ?? "",
    input.tppMinPct ?? "",
    input.tppMaxPct ?? "",
    input.preferredTppPct ?? "",
    input.minStockCount ?? "",
    input.maxStockCount ?? "",
    excluded,
    forced,
  ].join("|")
}
