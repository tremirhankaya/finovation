import { describe, expect, it } from "vitest"

import { buildOptimizationResultExcel } from "@/features/optimization/lib/optimizationExcelExport"
import type {
  ConstraintMetric,
  InfoMetric,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

const REQUEST: OptimizationRequestResponse = {
  id: 9001,
  fundId: "11111111-1111-4111-8111-111111111111",
  dataTimestamp: "2026-08-06T10:00:00",
  modelVersion: "v1.2.0",
  requestedByUserId: 7,
  requestedByUsername: "sefa.ecir",
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

const CONSTRAINT_METRICS: ConstraintMetric[] = [
  {
    key: "TOTAL_EQUITY_WEIGHT",
    label: "Toplam Hisse Ağırlığı",
    value: 90,
    status: "GREEN",
    detail: "İzahname %85–%95, hedef bant %86–%94",
  },
]

const INFO_METRICS: InfoMetric[] = [
  {
    key: "BETA",
    label: "Beta",
    currentValue: 1.05,
    proposedValue: 0.98,
    status: "GREEN",
    detail: "Azaldı",
  },
]

const SUMMARY = {
  increasedCount: 2,
  decreasedCount: 1,
  keptCount: 0,
  overriddenCount: 0,
}

describe("buildOptimizationResultExcel", () => {
  it("beklenen 5 sayfayı oluşturur", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
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
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    const sheet = workbook.getWorksheet("Varlıklar")
    expect(sheet?.rowCount).toBe(ASSETS.length + 1)
  })

  it("sektör dağılımını doğru toplar", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    const sheet = workbook.getWorksheet("Sektör Dağılımı")
    const bankacilikRow = sheet
      ?.getRows(2, sheet.rowCount - 1)
      ?.find((row) => row.getCell(1).value === "Bankacılık")

    expect(bankacilikRow?.getCell(2).value).toBe(13)
    expect(bankacilikRow?.getCell(3).value).toBe(13)
  })

  it("xlsx buffer'ı hatasız üretir", async () => {
    const workbook = await buildOptimizationResultExcel({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})
