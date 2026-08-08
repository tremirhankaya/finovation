import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildOptimizationResultPdf } from "@/features/optimization/lib/optimizationPdfExport"
import type {
  ConstraintMetric,
  InfoMetric,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

const fontsDir = resolve(
  process.cwd(),
  "src/features/optimization/assets/fonts",
)
const regularFontBytes = readFileSync(resolve(fontsDir, "Roboto-Regular.ttf"))
const boldFontBytes = readFileSync(resolve(fontsDir, "Roboto-Bold.ttf"))

const REQUEST: OptimizationRequestResponse = {
  id: 9001,
  fundId: "11111111-1111-4111-8111-111111111111",
  dataTimestamp: "2026-08-06T10:00:00",
  modelVersion: "v1.2.0",
  requestedByUserId: 7,
  requestedByUsername: "sefa.ecir",
  riskProfile: "BALANCED",
  status: "APPROVED",
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
  increasedCount: 1,
  decreasedCount: 1,
  keptCount: 0,
  overriddenCount: 0,
}

describe("buildOptimizationResultPdf", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        const bytes = href.includes("Bold") ? boldFontBytes : regularFontBytes
        return new Response(bytes)
      }),
    )
  })

  it("bir jsPDF dokümanı üretir", async () => {
    const doc = await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("gerekçesi olmayan varlıklarda gerekçe tablosunu atlamadan diğer bölümleri üretir", async () => {
    const doc = await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: [{ ...ASSETS[0], rationale: null }],
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("boş varlık listesinde hata fırlatmaz", async () => {
    await expect(
      buildOptimizationResultPdf({
        fundName: "Finovation Atlas Fonu",
        request: REQUEST,
        assets: [],
        summary: SUMMARY,
        constraintMetrics: CONSTRAINT_METRICS,
        infoMetrics: INFO_METRICS,
      }),
    ).resolves.toBeDefined()
  })

  it("Türkçe karakterleri içeren metni hatasız yerleştirir", async () => {
    const doc = await buildOptimizationResultPdf({
      fundName: "Şeker Yatırım Öğrenci Fonu ığüşçö",
      request: REQUEST,
      assets: ASSETS,
      summary: SUMMARY,
      constraintMetrics: CONSTRAINT_METRICS,
      infoMetrics: INFO_METRICS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
})
