import { describe, expect, it } from "vitest"

import { buildConstraintMetricInput } from "@/features/optimization/lib/optimizationConstraintMetricInput"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

function asset(overrides: Partial<OptimizationResultAsset>): OptimizationResultAsset {
  return {
    assetCode: "AKBNK.E",
    name: "Akbank",
    sectorName: "Bankacılık",
    assetType: "EQUITY",
    currentWeight: 10,
    proposedWeight: 10,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    ...overrides,
  }
}

describe("buildConstraintMetricInput", () => {
  it("asset yokken tüm alanları null döner", () => {
    const result = buildConstraintMetricInput([], 5, 15, 16, 30)

    expect(result.totalEquityWeight).toBeNull()
    expect(result.tppWeight).toBeNull()
    expect(result.stockCount).toBeNull()
    expect(result.maxSingleStockWeight).toBeNull()
    expect(result.maxSectorConcentration).toBeNull()
    expect(result.tppUserMin).toBe(5)
    expect(result.tppUserMax).toBe(15)
  })

  it("hisse ve TPP ağırlıklarını proposedWeight üzerinden toplar", () => {
    const assets = [
      asset({ assetCode: "AKBNK.E", sectorName: "Bankacılık", proposedWeight: 40 }),
      asset({ assetCode: "ASELS.E", sectorName: "Savunma", proposedWeight: 45 }),
      asset({
        assetCode: "TPP1G",
        assetType: "TPP",
        sectorName: null,
        proposedWeight: 15,
      }),
    ]

    const result = buildConstraintMetricInput(assets, 5, 15, 16, 30)

    expect(result.totalEquityWeight).toBe(85)
    expect(result.tppWeight).toBe(15)
    expect(result.stockCount).toBe(2)
    expect(result.maxSingleStockWeight).toBe(45)
    expect(result.maxSectorConcentration).toBe(45)
  })

  it("finalWeight varsa proposedWeight yerine onu kullanır", () => {
    const assets = [
      asset({ proposedWeight: 40, finalWeight: 30 }),
      asset({
        assetCode: "TPP1G",
        assetType: "TPP",
        sectorName: null,
        proposedWeight: 60,
        finalWeight: 70,
      }),
    ]

    const result = buildConstraintMetricInput(assets, 5, 15, 16, 30)

    expect(result.totalEquityWeight).toBe(30)
    expect(result.tppWeight).toBe(70)
  })

  it("ağırlığı sıfırlanan (çıkarılan) hisseleri hisse sayısına katmaz", () => {
    const assets = [
      asset({ assetCode: "AKBNK.E", proposedWeight: 90 }),
      asset({ assetCode: "AEFES.E", proposedWeight: 0 }),
      asset({
        assetCode: "TPP1G",
        assetType: "TPP",
        sectorName: null,
        proposedWeight: 10,
      }),
    ]

    const result = buildConstraintMetricInput(assets, 5, 15, 16, 30)

    expect(result.stockCount).toBe(1)
  })

  it("aynı sektördeki hisseleri toplayıp en yüksek sektör yoğunlaşmasını döner", () => {
    const assets = [
      asset({ assetCode: "AKBNK.E", sectorName: "Bankacılık", proposedWeight: 20 }),
      asset({ assetCode: "GARAN.E", sectorName: "Bankacılık", proposedWeight: 15 }),
      asset({ assetCode: "ASELS.E", sectorName: "Savunma", proposedWeight: 10 }),
      asset({
        assetCode: "TPP1G",
        assetType: "TPP",
        sectorName: null,
        proposedWeight: 55,
      }),
    ]

    const result = buildConstraintMetricInput(assets, 5, 15, 16, 30)

    expect(result.maxSectorConcentration).toBe(35)
  })
})
