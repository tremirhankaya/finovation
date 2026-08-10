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
  stockCountMax: 30,
  keptAssetCount: 2,
  keptWeightSum: 16,
  forceAddedAssetCount: 1,
  excludedAssetCount: 1,
  currentEquityWeightPct: 90,
  maxSingleStockWeightPct: 8,
  minSingleStockWeightPct: 4,
  maxSectorWeightPct: 16,
  currentStockCount: 30,
  heldExcludedAssetCount: 1,
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

  it("hisse sayısı sistem sınırının (16-30) dışındaysa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 10,
      stockCountMax: 25,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMSUZ")
  })

  it("hisse sayısı üst sınırı (30) aşarsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 16,
      stockCountMax: 31,
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

  it("sabit + zorunlu hisse sayısı seçilen üst sınırı aşarsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 16,
      stockCountMax: 21,
      keptAssetCount: 25,
      forceAddedAssetCount: 0,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMSUZ")
    expect(stockCountRow?.detail).toContain("25 hisse")
  })

  it("B'den çıkarma + D'den zorunlu ekleme sonucu projekte edilen hisse sayısı seçilen aralığın altında kalırsa DIKKAT verir ama gönderimi engellemez", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 21,
      stockCountMax: 26,
      currentStockCount: 21,
      heldExcludedAssetCount: 3,
      forceAddedAssetCount: 0,
      keptAssetCount: 0,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("DIKKAT")
    expect(stockCountRow?.detail).toContain("18 hisseye")
    expect(isComplianceReady(rows)).toBe(true)
  })

  it("C'de yapılan hariç tutmalar projekte edilen hisse sayısını etkilemez", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 21,
      stockCountMax: 26,
      currentStockCount: 21,
      heldExcludedAssetCount: 0,
      forceAddedAssetCount: 0,
      keptAssetCount: 0,
      excludedAssetCount: 3,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMLU")
  })

  it("B'den çıkarma + D'den zorunlu eklemeyle projekte edilen hisse sayısı seçilen aralığa uyarsa UYUMLU verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      stockCountMin: 21,
      stockCountMax: 26,
      currentStockCount: 21,
      heldExcludedAssetCount: 0,
      forceAddedAssetCount: 3,
      keptAssetCount: 0,
    })

    const stockCountRow = rows.find((row) => row.key === "stock-count")
    expect(stockCountRow?.status).toBe("UYUMLU")
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

  it("mevcut hisse toplam ağırlığı %85-%95 dışındaysa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      currentEquityWeightPct: 80,
    })

    const equityRow = rows.find((row) => row.key === "equity-weight")
    expect(equityRow?.status).toBe("UYUMSUZ")
  })

  it("hisse toplam ağırlığı verisi yoksa UYUMLU kabul eder", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      currentEquityWeightPct: null,
    })

    const equityRow = rows.find((row) => row.key === "equity-weight")
    expect(equityRow?.status).toBe("UYUMLU")
  })

  it("fondaki bir hisse %10'u aşan ağırlığa sahipse UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      maxSingleStockWeightPct: 12,
    })

    const singleStockRow = rows.find((row) => row.key === "single-stock-weight")
    expect(singleStockRow?.status).toBe("UYUMSUZ")
  })

  it("fondaki bir hisse %3'ün altında ağırlığa sahipse UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      minSingleStockWeightPct: 2.4,
    })

    const singleStockRow = rows.find((row) => row.key === "single-stock-weight")
    expect(singleStockRow?.status).toBe("UYUMSUZ")
    expect(singleStockRow?.detail).toContain("alt limit")
  })

  it("fondaki bir sektörün toplamı %30'u aşarsa UYUMSUZ verir", () => {
    const rows = buildComplianceRows({
      ...VALID_INPUT,
      maxSectorWeightPct: 35,
    })

    const sectorRow = rows.find((row) => row.key === "sector-concentration")
    expect(sectorRow?.status).toBe("UYUMSUZ")
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
