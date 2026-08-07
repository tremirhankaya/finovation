import { describe, expect, it } from "vitest"

import { buildRulesFingerprint } from "@/features/fund-design/lib/rulesFingerprint"

describe("buildRulesFingerprint", () => {
  it("sorts asset codes so order does not change the fingerprint", () => {
    const left = buildRulesFingerprint({
      managementApproach: "ATTACK",
      tppMinPct: 10,
      tppMaxPct: 14,
      preferredTppPct: 12,
      minStockCount: 16,
      maxStockCount: 21,
      excludedAssetCodes: ["THYAO", "MGROS"],
      forcedAssetCodes: ["ASELS", "BIMAS"],
    })
    const right = buildRulesFingerprint({
      managementApproach: "ATTACK",
      tppMinPct: 10,
      tppMaxPct: 14,
      preferredTppPct: 12,
      minStockCount: 16,
      maxStockCount: 21,
      excludedAssetCodes: ["MGROS", "THYAO"],
      forcedAssetCodes: ["BIMAS", "ASELS"],
    })
    expect(left).toBe(right)
  })
})
