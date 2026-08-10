import { describe, expect, it } from "vitest"

import { buildOptimizationResultExcel } from "@/features/optimization/lib/optimizationExcelExport"
import type { CriteriaRow } from "@/features/optimization/lib/optimizationCriteriaRows"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

const REQUEST: OptimizationRequestResponse = {
  id: 9001,
  fundId: "11111111-1111-4111-8111-111111111111",
  dataTimestamp: "2026-08-06T10:00:00",
  modelVersion: "v1.2.0",
  requestedByUserId: 7,
  requestedByUsername: "sefa.ecir",
  decidedByUserId: 7,
  decidedByUsername: "sefa.ecir",
  decidedByDisplayName: "Sefa Ecir",
  riskProfile: "BALANCED",
  status: "APPROVED",
  maxAdditions: 3,
  tppMinWeight: 5,
  tppMaxWeight: 15,
  stockCountMin: 16,
  stockCountMax: 30,
  startedAt: "2026-08-06T10:00:00",
  completedAt: "2026-08-06T10:01:00",
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:05:00",
}

const ASSETS: OptimizationResultAsset[] = [
  {
    assetCode: "AKBNK",
    name: "Akbank",
    sectorName: "Bankacılık",
    assetType: "EQUITY",
    currentWeight: 8,
    proposedWeight: 6,
    finalWeight: null,
    changeAmount: -2,
    actionType: "DECREASE",
    manuallyOverridden: false,
    rationale: "Sektör yoğunlaşmasını azaltmak için düşürüldü.",
  },
  {
    assetCode: "YKBNK",
    name: "Yapı Kredi",
    sectorName: "Bankacılık",
    assetType: "EQUITY",
    currentWeight: 5,
    proposedWeight: 7,
    finalWeight: 7,
    changeAmount: 2,
    actionType: "INCREASE",
    manuallyOverridden: false,
    rationale: null,
  },
  {
    assetCode: "TPP1G",
    name: "Takasbank Para Piyasası",
    sectorName: null,
    assetType: "TPP",
    currentWeight: 5,
    proposedWeight: 7,
    finalWeight: 7,
    changeAmount: 2,
    actionType: "INCREASE",
    manuallyOverridden: false,
    rationale: null,
  },
]

const CRITERIA_ROWS: CriteriaRow[] = [
  {
    key: "TOTAL_EQUITY_WEIGHT",
    label: "Toplam Hisse Ağırlığı",
    currentValue: 88,
    proposedValue: 90,
    status: "GREEN",
    detail: "İzahname %85–%95, hedef bant %86–%94",
    unit: "PERCENT",
  },
  {
    key: "BETA",
    label: "Beta",
    currentValue: 1.05,
    proposedValue: 0.98,
    status: "GREEN",
    detail: "Azaldı",
    unit: "RATIO",
  },
]

describe("buildOptimizationResultExcel", () => {
  it("beklenen 5 sayfayı oluşturur", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Özet",
      "Varlıklar",
      "Sektör Dağılımı",
      "Kısıt Uyumu",
      "Risk Metrikleri",
    ])
  })

  it("varlıklar sayfasında her varlık için bir satır oluşturur", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Varlıklar")
    expect(sheet?.rowCount).toBe(ASSETS.length + 1)
  })

  it("sektör dağılımını doğru toplar", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Sektör Dağılımı")
    const bankacilikRow = sheet
      ?.getRows(2, sheet.rowCount - 1)
      ?.find((row) => row.getCell(1).value === "Bankacılık")

    expect(bankacilikRow?.getCell(2).value).toBe(13)
    expect(bankacilikRow?.getCell(3).value).toBe(13)
  })

  it("manuel değiştirilen bir hissede Değişim ve İşlem Yönü'nü bayat statik alana göre değil canlı final ağırlığa göre hesaplar", async () => {
    const manuallyOverriddenAssets: OptimizationResultAsset[] = [
      {
        assetCode: "AKBNK",
        name: "Akbank",
        sectorName: "Bankacılık",
        assetType: "EQUITY",
        currentWeight: 10,
        proposedWeight: 7,
        finalWeight: 12,
        changeAmount: -3,
        actionType: "DECREASE",
        manuallyOverridden: true,
        rationale: null,
      },
    ]

    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: manuallyOverriddenAssets,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Varlıklar")
    const row = sheet?.getRow(2)

    expect(row?.getCell(7).value).toBe(12)
    expect(row?.getCell(8).value).toBe(2)
    expect(row?.getCell(9).value).toBe("Artırıldı")
  })

  it("Sektör Dağılımı, manuel değiştirilen final ağırlığı model önerisi yerine kullanır", async () => {
    const manuallyOverriddenAssets: OptimizationResultAsset[] = [
      {
        assetCode: "AKBNK",
        name: "Akbank",
        sectorName: "Bankacılık",
        assetType: "EQUITY",
        currentWeight: 10,
        proposedWeight: 7,
        finalWeight: 12,
        changeAmount: -3,
        actionType: "DECREASE",
        manuallyOverridden: true,
        rationale: null,
      },
    ]

    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: manuallyOverriddenAssets,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Sektör Dağılımı")
    const bankacilikRow = sheet
      ?.getRows(2, sheet.rowCount - 1)
      ?.find((row) => row.getCell(1).value === "Bankacılık")

    expect(bankacilikRow?.getCell(3).value).toBe(12)
  })

  it("Kısıt Uyumu sayfasında Mevcut ve Optimize Edilmiş'i ayrı sütunlarda gösterir", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Kısıt Uyumu")
    const row = sheet
      ?.getRows(2, sheet.rowCount - 1)
      ?.find((r) => r.getCell(1).value === "Toplam Hisse Ağırlığı")

    expect(row?.getCell(2).value).toBe(88)
    expect(row?.getCell(3).value).toBe(90)
    expect(row?.getCell(4).value).toBe("Uyumlu")
  })

  it("Risk Metrikleri sayfası RATIO birimli satırları ayrıştırır", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Risk Metrikleri")
    expect(sheet?.rowCount).toBe(2)
    expect(sheet?.getRow(2).getCell(1).value).toBe("Beta")
  })

  it("henüz onaylanmamış/reddedilmemiş istekte Onay/red zamanını boş gösterir", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: { ...REQUEST, status: "COMPLETED" },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Özet")
    const decisionRow = sheet
      ?.getRows(1, sheet.rowCount)
      ?.find((row) => row.getCell(1).value === "Onay/red zamanı")

    expect(decisionRow?.getCell(2).value).toBe("—")
  })

  it("onaylanmış istekte Onay/red zamanını gösterir", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: { ...REQUEST, status: "APPROVED" },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Özet")
    const decisionRow = sheet
      ?.getRows(1, sheet.rowCount)
      ?.find((row) => row.getCell(1).value === "Onay/red zamanı")

    expect(decisionRow?.getCell(2).value).not.toBe("—")
  })

  it("Model sürümü satırını Özet sayfasında göstermez", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Özet")
    const modelVersionRow = sheet
      ?.getRows(1, sheet.rowCount)
      ?.find((row) => row.getCell(1).value === "Model sürümü")

    expect(modelVersionRow).toBeUndefined()
  })

  it("Artırılan/Azaltılan hisse sayısını ham actionType yerine ekrandaki kategori mantığıyla hesaplar", async () => {
    const roundingMismatchAssets: OptimizationResultAsset[] = [
      {
        assetCode: "TCELL",
        name: "Turkcell",
        sectorName: "Telekomünikasyon",
        assetType: "EQUITY",
        currentWeight: 6.3,
        proposedWeight: 6.4,
        finalWeight: null,
        changeAmount: 0.1,
        actionType: "INCREASE",
        manuallyOverridden: false,
        rationale: null,
      },
    ]

    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: roundingMismatchAssets,
      criteriaRows: CRITERIA_ROWS,
    })

    const sheet = workbook.getWorksheet("Özet")
    const increasedRow = sheet
      ?.getRows(1, sheet.rowCount)
      ?.find((row) => row.getCell(1).value === "Artırılan hisse sayısı")

    expect(increasedRow?.getCell(2).value).toBe("0")
  })

  it("xlsx buffer'ı hatasız üretir", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
