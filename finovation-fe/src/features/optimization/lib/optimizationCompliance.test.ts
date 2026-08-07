import { describe, expect, it } from "vitest"

import {
  buildComplianceRows,
  isComplianceReady,
  type ComplianceInput,
} from "@/features/optimization/lib/optimizationCompliance"

const VALID_INPUT: ComplianceInput = {
  tppMinWeight: 5,
  tppMaxWeight: 15,
  stockCountMin: 16,
  stockCountMax: 35,
  keptAssetCount: 2,
  keptWeightSum: 16,
  forceAddedAssetCount: 1,
  excludedAssetCount: 1,
}

describe("buildComplianceRows", () => {
  it("geçerli girdilerde tüm satırları UYUMLU olarak işaretler", () => {
    const rows = buildComplianceRows(VALID_INPUT)

    expect(rows.every((row) => row.status === "UYUMLU")).toBe(true)
    expect(isComplianceReady(rows)).toBe(true)
  })

  it("TPP aralık genişliği 3 puandan darsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      tppMinWeight: 10,
      tppMaxWeight: 11,
    })

    const tppRow = rows.find((row) => row.key === "tpp-range")
    expect(tppRow?.status).toBe("UYUMSUZ")
    expect(isComplianceReady(rows)).toBe(false)
  })

  it("hisse sayısı sistem sınırının (16-35) dışındaysa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 10,
      stockCountMax: 30,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMSUZ")
  })

  it("hisse sayısı aralık genişliği 5'ten darsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 16,
      stockCountMax: 19,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMSUZ")
  })

  it("sabit + zorunlu ağırlık toplamı %95'i aşarsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      keptWeightSum: 90,
      forceAddedAssetCount: 6,
    })

    const keptRow = rows.find((row) => row.key === "kept-assets")
    expect(keptRow?.status).toBe("UYUMSUZ")
  })

  it("herhangi bir satır UYUMSUZ ise toplam uygulanabilirliği UYUMSUZ yapar", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      tppMinWeight: 10,
      tppMaxWeight: 11,
    })

    const overallRow = rows.find((row) => row.key === "overall")
    expect(overallRow?.status).toBe("UYUMSUZ")
  })
})
