import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const autoTableMock = vi.hoisted(() => vi.fn())

vi.mock("jspdf-autotable", () => ({
  autoTable: autoTableMock,
}))

import { buildOptimizationResultPdf } from "@/features/optimization/lib/optimizationPdfExport"
import type { CriteriaRow } from "@/features/optimization/lib/optimizationCriteriaRows"
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
  requestedByDisplayName: "Sefa Ecir",
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
  rejectionReason: null,
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

const CRITERIA_ROWS: CriteriaRow[] = [
  {
    key: "TOTAL_PORTFOLIO_WEIGHT",
    label: "Toplam Portföy Ağırlığı",
    currentValue: 100,
    proposedValue: 100,
    status: "GREEN",
    detail: "Hisse + TPP toplamı %100 olmalı",
    unit: "PERCENT",
  },
  {
    key: "MAX_SINGLE_STOCK_WEIGHT",
    label: "En Yüksek Tek Hisse Ağırlığı",
    currentValue: 8,
    proposedValue: 10,
    status: "AMBER",
    detail: "Üst limit %10",
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
  {
    key: "TRACKING_ERROR",
    label: "Tracking Error",
    currentValue: 5.75,
    proposedValue: 6.42,
    status: "NEUTRAL",
    detail: "Amaca bağlı yorumlanır",
    unit: "RATIO",
  },
]

describe("buildOptimizationResultPdf", () => {
  beforeEach(() => {
    autoTableMock.mockClear()
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
      criteriaRows: CRITERIA_ROWS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("gerekçesi olmayan varlıklarda gerekçe tablosunu atlamadan diğer bölümleri üretir", async () => {
    const doc = await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: [{ ...ASSETS[0], rationale: null }],
      criteriaRows: CRITERIA_ROWS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("boş varlık listesinde hata fırlatmaz", async () => {
    await expect(
      buildOptimizationResultPdf({
        fundName: "Finovation Atlas Fonu",
        request: REQUEST,
        assets: [],
        criteriaRows: CRITERIA_ROWS,
      }),
    ).resolves.toBeDefined()
  })

  it("Türkçe karakterleri içeren metni hatasız yerleştirir", async () => {
    const doc = await buildOptimizationResultPdf({
      fundName: "Şeker Yatırım Öğrenci Fonu ığüşçö",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it("yüzde değerlerini yanlışlıkla kırpmadan (100 → 10 gibi) doğru basar", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const constraintTableCall = autoTableMock.mock.calls.find(([, options]) =>
      options.head?.[0]?.includes("Kriter"),
    )
    expect(constraintTableCall).toBeDefined()
    const [, constraintOptions] = constraintTableCall!
    expect(constraintOptions.body).toEqual(
      expect.arrayContaining([
        ["Toplam Portföy Ağırlığı", "%100", "%100", "—", "Uyumlu", "Hisse + TPP toplamı %100 olmalı"],
        [
          "En Yüksek Tek Hisse Ağırlığı",
          "%8",
          "%10",
          "+%2",
          "Sınıra Yakın",
          "Üst limit %10",
        ],
      ]),
    )
  })

  it("NEUTRAL durumunu ekrandaki gibi 'Bilgi' olarak gösterir, 'Kontrol Edilemedi' demez", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const infoTableCall = autoTableMock.mock.calls.find(([, options]) =>
      options.head?.[0]?.includes("Metrik"),
    )
    expect(infoTableCall).toBeDefined()
    const [, infoOptions] = infoTableCall!
    const trackingErrorRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Tracking Error",
    )
    expect(trackingErrorRow[4]).toBe("Bilgi")
  })

  it("Portföy Değişim Özeti'ni ham actionType yerine ekrandaki kategori mantığıyla hesaplar", async () => {
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

    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: REQUEST,
      assets: roundingMismatchAssets,
      criteriaRows: CRITERIA_ROWS,
    })

    const summaryTableCall = autoTableMock.mock.calls.find(([, options]) =>
      options.head?.[0]?.includes("Artırılan"),
    )
    expect(summaryTableCall).toBeDefined()
    const [, summaryOptions] = summaryTableCall!
    expect(summaryOptions.body[0][0]).toBe("0")
  })

  it("henüz onaylanmamış/reddedilmemiş istekte Onay/red zamanını boş gösterir", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: { ...REQUEST, status: "COMPLETED" },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const [, infoOptions] = autoTableMock.mock.calls[0]
    const decisionRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Onay/red zamanı",
    )
    expect(decisionRow[1]).toBe("—")
  })

  it("onaylanmış istekte Onay/red zamanını gösterir", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: { ...REQUEST, status: "APPROVED" },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const [, infoOptions] = autoTableMock.mock.calls[0]
    const decisionRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Onay/red zamanı",
    )
    expect(decisionRow[1]).not.toBe("—")
  })

  it("reddedilen istekte Durum satırı Reddedildi'yi, Onaylayan/Reddeden satırı gerçek reddedeni gösterir", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: {
        ...REQUEST,
        status: "REJECTED",
        requestedByUsername: "sefa.ecir",
        requestedByDisplayName: null,
        decidedByUsername: "onaylayan",
        decidedByDisplayName: "Onay Veren",
      },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const [, infoOptions] = autoTableMock.mock.calls[0]
    const statusRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Durum",
    )
    expect(statusRow[1]).toBe("Reddedildi")

    const requesterRow = infoOptions.body.find(
      (row: string[]) => row[0] === "İsteği oluşturan",
    )
    expect(requesterRow[1]).toBe("sefa.ecir")

    const deciderRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Onaylayan/Reddeden",
    )
    expect(deciderRow[1]).toBe("Onay Veren")
  })

  it("İsteği oluşturan alanında ad soyad varsa kullanıcı adı yerine onu gösterir", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: {
        ...REQUEST,
        requestedByUsername: "sefa.ecir",
        requestedByDisplayName: "Sefa Ecir",
      },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const [, infoOptions] = autoTableMock.mock.calls[0]
    const requesterRow = infoOptions.body.find(
      (row: string[]) => row[0] === "İsteği oluşturan",
    )
    expect(requesterRow[1]).toBe("Sefa Ecir")
  })

  it("henüz karar verilmemiş istekte Onaylayan/Reddeden alanını boş gösterir", async () => {
    await buildOptimizationResultPdf({
      fundName: "Finovation Atlas Fonu",
      request: {
        ...REQUEST,
        status: "COMPLETED",
        decidedByUsername: null,
        decidedByDisplayName: null,
      },
      assets: ASSETS,
      criteriaRows: CRITERIA_ROWS,
    })

    const [, infoOptions] = autoTableMock.mock.calls[0]
    const deciderRow = infoOptions.body.find(
      (row: string[]) => row[0] === "Onaylayan/Reddeden",
    )
    expect(deciderRow[1]).toBe("—")
  })
})
