import { describe, expect, it } from "vitest"

import {
  UNKNOWN_RATIONALE_SECTOR_LABEL,
  sortRationaleAssetsBySector,
} from "@/features/optimization/lib/optimizationRationaleSectors"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

function asset(
  overrides: Partial<OptimizationResultAsset> & { assetCode: string },
): OptimizationResultAsset {
  return {
    name: overrides.assetCode,
    sectorName: null,
    assetType: "EQUITY",
    currentWeight: 5,
    proposedWeight: 5,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    userLocked: false,
    ...overrides,
  }
}

describe("sortRationaleAssetsBySector", () => {
  it("aynı sektördeki hisseleri yan yana kümeler", () => {
    const sorted = sortRationaleAssetsBySector([
      asset({ assetCode: "TTKOM.E", sectorName: "Telekomünikasyon" }),
      asset({ assetCode: "AKBNK.E", sectorName: "Bankacılık" }),
      asset({ assetCode: "GARAN.E", sectorName: "Bankacılık" }),
    ])

    expect(sorted.map((a) => a.assetCode)).toEqual([
      "AKBNK.E",
      "GARAN.E",
      "TTKOM.E",
    ])
  })

  it("sektörü olmayanları Sektör Bilgisi Yok anahtarıyla sıralamaya dahil eder", () => {
    const sorted = sortRationaleAssetsBySector([
      asset({ assetCode: "AKBNK.E", sectorName: "Bankacılık" }),
      asset({ assetCode: "TPP1G", sectorName: null }),
    ])

    expect(sorted.map((a) => a.assetCode)).toEqual(["AKBNK.E", "TPP1G"])
    expect(UNKNOWN_RATIONALE_SECTOR_LABEL).toBe("Sektör Bilgisi Yok")
  })

  it("orijinal diziyi değiştirmez", () => {
    const original = [
      asset({ assetCode: "B.E", sectorName: "B" }),
      asset({ assetCode: "A.E", sectorName: "A" }),
    ]
    sortRationaleAssetsBySector(original)

    expect(original.map((a) => a.assetCode)).toEqual(["B.E", "A.E"])
  })

  it("boş listede boş dizi döner", () => {
    expect(sortRationaleAssetsBySector([])).toEqual([])
  })
})
