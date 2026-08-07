import { Workbook } from "exceljs"

import {
  ACTION_TYPE_LABELS,
  CONSTRAINT_STATUS_LABELS,
  formatDateTime,
  INFO_STATUS_LABELS,
  RISK_PROFILE_LABELS,
} from "@/features/optimization/lib/optimizationExportLabels"
import type {
  ConstraintMetric,
  InfoMetric,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF0F766A" },
}
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } }

const BORDER_SIDE = { style: "thin" as const, color: { argb: "FFD1D5DB" } }
const CELL_BORDER = {
  top: BORDER_SIDE,
  left: BORDER_SIDE,
  bottom: BORDER_SIDE,
  right: BORDER_SIDE,
}

type StyleableCell = {
  fill: unknown
  font: unknown
  border: unknown
}

type StyleableRow = {
  eachCell: (callback: (cell: StyleableCell) => void) => void
}

function styleHeaderRow(row: StyleableRow): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.border = CELL_BORDER
  })
}

function styleBodyRow(row: StyleableRow): void {
  row.eachCell((cell) => {
    cell.border = CELL_BORDER
  })
}

export type OptimizationExcelExportSummary = {
  increasedCount: number
  decreasedCount: number
  keptCount: number
  overriddenCount: number
}

export type OptimizationExcelExportInput = {
  fundName: string
  request: OptimizationRequestResponse
  assets: OptimizationResultAsset[]
  summary: OptimizationExcelExportSummary
  constraintMetrics: ConstraintMetric[]
  infoMetrics: InfoMetric[]
}

function addSummarySheet(
  workbook: Workbook,
  input: OptimizationExcelExportInput,
): void {
  const sheet = workbook.addWorksheet("Özet")
  sheet.columns = [
    { header: "Alan", key: "label", width: 28 },
    { header: "Bilgi", key: "value", width: 45 },
  ]
  styleHeaderRow(sheet.getRow(1))

  const rows: [string, string][] = [
    ["Fon", input.fundName],
    ["Optimizasyon isteği", `#${input.request.id}`],
    [
      "Risk profili",
      RISK_PROFILE_LABELS[input.request.riskProfile] ??
        input.request.riskProfile,
    ],
    ["Model sürümü", input.request.modelVersion ?? "—"],
    ["Veri zamanı", formatDateTime(input.request.dataTimestamp)],
    ["İşlemi yapan", input.request.requestedByUsername ?? "—"],
    ["Onay/red zamanı", formatDateTime(input.request.updatedAt)],
    ["Artırılan hisse sayısı", String(input.summary.increasedCount)],
    ["Azaltılan hisse sayısı", String(input.summary.decreasedCount)],
    ["Korunan hisse sayısı", String(input.summary.keptCount)],
    ["Manuel değiştirilen hisse sayısı", String(input.summary.overriddenCount)],
  ]

  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value])
    row.getCell(1).font = { bold: true }
    styleBodyRow(row)
  }
}

function addAssetsSheet(
  workbook: Workbook,
  assets: OptimizationResultAsset[],
): void {
  const sheet = workbook.addWorksheet("Varlıklar")
  sheet.columns = [
    { header: "Kod", key: "assetCode", width: 12 },
    { header: "Ad", key: "name", width: 26 },
    { header: "Sektör", key: "sectorName", width: 22 },
    { header: "Tür", key: "assetType", width: 10 },
    { header: "Mevcut Ağırlık (%)", key: "currentWeight", width: 18 },
    { header: "Önerilen Ağırlık (%)", key: "proposedWeight", width: 18 },
    { header: "Final Ağırlık (%)", key: "finalWeight", width: 16 },
    { header: "Değişim (puan)", key: "changeAmount", width: 16 },
    { header: "İşlem Yönü", key: "actionType", width: 14 },
    { header: "Manuel Değiştirildi mi", key: "manuallyOverridden", width: 20 },
    { header: "Gerekçe", key: "rationale", width: 50 },
  ]
  styleHeaderRow(sheet.getRow(1))

  for (const asset of assets) {
    const row = sheet.addRow({
      assetCode: asset.assetCode,
      name: asset.name,
      sectorName: asset.sectorName ?? "—",
      assetType: asset.assetType,
      currentWeight: asset.currentWeight,
      proposedWeight: asset.proposedWeight,
      finalWeight: asset.finalWeight ?? asset.proposedWeight,
      changeAmount: asset.changeAmount,
      actionType: ACTION_TYPE_LABELS[asset.actionType] ?? asset.actionType,
      manuallyOverridden: asset.manuallyOverridden ? "Evet" : "Hayır",
      rationale: asset.rationale ?? "",
    })
    styleBodyRow(row)
  }
}

function addSectorDistributionSheet(
  workbook: Workbook,
  assets: OptimizationResultAsset[],
): void {
  const sheet = workbook.addWorksheet("Sektör Dağılımı")
  sheet.columns = [
    { header: "Sektör", key: "sectorName", width: 26 },
    { header: "Mevcut Ağırlık Toplamı (%)", key: "current", width: 24 },
    { header: "Önerilen Ağırlık Toplamı (%)", key: "proposed", width: 26 },
    { header: "Değişim (puan)", key: "change", width: 16 },
  ]
  styleHeaderRow(sheet.getRow(1))

  const bySector = new Map<string, {
    current: number
    proposed: number
  }>()
  for (const asset of assets) {
    const sector = asset.sectorName ?? "Diğer"
    const entry = bySector.get(sector) ?? { current: 0, proposed: 0 }
    entry.current += asset.currentWeight
    entry.proposed += asset.proposedWeight
    bySector.set(sector, entry)
  }

  for (const [sectorName, { current, proposed }] of bySector) {
    const row = sheet.addRow({
      sectorName,
      current: Number(current.toFixed(2)),
      proposed: Number(proposed.toFixed(2)),
      change: Number((proposed - current).toFixed(2)),
    })
    styleBodyRow(row)
  }
}

function addConstraintMetricsSheet(
  workbook: Workbook,
  constraintMetrics: ConstraintMetric[],
): void {
  const sheet = workbook.addWorksheet("Kısıt Uyumu")
  sheet.columns = [
    { header: "Metrik", key: "label", width: 30 },
    { header: "Değer", key: "value", width: 12 },
    { header: "Durum", key: "status", width: 18 },
    { header: "Detay", key: "detail", width: 55 },
  ]
  styleHeaderRow(sheet.getRow(1))

  for (const metric of constraintMetrics) {
    const row = sheet.addRow({
      label: metric.label,
      value: metric.value ?? "—",
      status: CONSTRAINT_STATUS_LABELS[metric.status] ?? metric.status,
      detail: metric.detail,
    })
    styleBodyRow(row)
  }
}

function addInfoMetricsSheet(
  workbook: Workbook,
  infoMetrics: InfoMetric[],
): void {
  const sheet = workbook.addWorksheet("Risk Metrikleri")
  sheet.columns = [
    { header: "Metrik", key: "label", width: 24 },
    { header: "Mevcut", key: "currentValue", width: 12 },
    { header: "Önerilen", key: "proposedValue", width: 12 },
    { header: "Durum", key: "status", width: 18 },
    { header: "Detay", key: "detail", width: 40 },
  ]
  styleHeaderRow(sheet.getRow(1))

  for (const metric of infoMetrics) {
    const row = sheet.addRow({
      label: metric.label,
      currentValue: metric.currentValue ?? "—",
      proposedValue: metric.proposedValue ?? "—",
      status: INFO_STATUS_LABELS[metric.status] ?? metric.status,
      detail: metric.detail,
    })
    styleBodyRow(row)
  }
}

export async function buildOptimizationResultExcel(
  input: OptimizationExcelExportInput,
): Promise<Workbook> {
  const workbook = new Workbook()
  workbook.creator = "Finovation"
  workbook.created = new Date()

  addSummarySheet(workbook, input)
  addAssetsSheet(workbook, input.assets)
  addSectorDistributionSheet(workbook, input.assets)
  addConstraintMetricsSheet(workbook, input.constraintMetrics)
  addInfoMetricsSheet(workbook, input.infoMetrics)

  return workbook
}

export async function downloadOptimizationResultExcel(
  input: OptimizationExcelExportInput,
): Promise<void> {
  const workbook = await buildOptimizationResultExcel(input)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const fundSlug = input.fundName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `optimizasyon-${fundSlug || "fon"}-${input.request.id}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
