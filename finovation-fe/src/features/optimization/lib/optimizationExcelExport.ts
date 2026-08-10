import { Workbook } from "exceljs"

import {
  ACTION_TYPE_LABELS,
  formatDateTime,
  formatDecisionDateTime,
  RISK_PROFILE_LABELS,
} from "@/features/optimization/lib/optimizationExportLabels"
import {
  CRITERIA_STATUS_LABELS,
  type CriteriaRow,
} from "@/features/optimization/lib/optimizationCriteriaRows"
import { buildResultCategories } from "@/features/optimization/lib/optimizationResultCategories"
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

export type OptimizationExcelExportInput = {
  fundName: string
  request: OptimizationRequestResponse
  assets: OptimizationResultAsset[]
  criteriaRows: CriteriaRow[]
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

  const categories = buildResultCategories(input.assets)
  const countFor = (key: string) =>
    categories.find((category) => category.key === key)?.count ?? 0
  const overriddenCount = input.assets.filter(
    (asset) => asset.manuallyOverridden,
  ).length

  const rows: [string, string][] = [
    ["Fon", input.fundName],
    ["Optimizasyon isteği", `#${input.request.id}`],
    [
      "Risk profili",
      RISK_PROFILE_LABELS[input.request.riskProfile] ??
        input.request.riskProfile,
    ],
    ["Veri zamanı", formatDateTime(input.request.dataTimestamp)],
    ["İşlemi yapan", input.request.requestedByUsername ?? "—"],
    [
      "Onay/red zamanı",
      formatDecisionDateTime(input.request.status, input.request.updatedAt),
    ],
    ["Artırılan hisse sayısı", String(countFor("INCREASED"))],
    ["Azaltılan hisse sayısı", String(countFor("DECREASED"))],
    ["Sabit kalan hisse sayısı", String(countFor("LOCKED"))],
    ["Manuel değiştirilen hisse sayısı", String(overriddenCount)],
  ]

  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value])
    row.getCell(1).font = { bold: true }
    styleBodyRow(row)
  }
}

const DIRECTION_EPSILON = 0.001

function resolveActionLabel(currentWeight: number, finalWeight: number): string {
  const delta = finalWeight - currentWeight
  if (delta > DIRECTION_EPSILON) return ACTION_TYPE_LABELS.INCREASE
  if (delta < -DIRECTION_EPSILON) return ACTION_TYPE_LABELS.DECREASE
  return ACTION_TYPE_LABELS.KEEP
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
    const finalWeight = asset.finalWeight ?? asset.proposedWeight
    const row = sheet.addRow({
      assetCode: asset.assetCode,
      name: asset.name,
      sectorName: asset.sectorName ?? "—",
      assetType: asset.assetType,
      currentWeight: asset.currentWeight,
      proposedWeight: asset.proposedWeight,
      finalWeight,
      changeAmount: Number((finalWeight - asset.currentWeight).toFixed(2)),
      actionType: resolveActionLabel(asset.currentWeight, finalWeight),
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
    { header: "Optimize Edilmiş Ağırlık Toplamı (%)", key: "proposed", width: 30 },
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
    entry.proposed += asset.finalWeight ?? asset.proposedWeight
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

function addCriteriaSheet(
  workbook: Workbook,
  sheetName: string,
  rows: CriteriaRow[],
): void {
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = [
    { header: "Kriter", key: "label", width: 30 },
    { header: "Mevcut", key: "currentValue", width: 12 },
    { header: "Optimize Edilmiş", key: "proposedValue", width: 16 },
    { header: "Durum", key: "status", width: 18 },
    { header: "Detay", key: "detail", width: 55 },
  ]
  styleHeaderRow(sheet.getRow(1))

  for (const row of rows) {
    const excelRow = sheet.addRow({
      label: row.label,
      currentValue: row.currentValue ?? "—",
      proposedValue: row.proposedValue ?? "—",
      status: CRITERIA_STATUS_LABELS[row.status] ?? row.status,
      detail: row.detail,
    })
    styleBodyRow(excelRow)
  }
}

export async function buildOptimizationResultExcel(
  input: OptimizationExcelExportInput,
): Promise<Workbook> {
  const workbook = new Workbook()
  workbook.creator = "Finovation"
  workbook.created = new Date()

  const constraintRows = input.criteriaRows.filter(
    (row) => row.unit !== "RATIO",
  )
  const infoRows = input.criteriaRows.filter((row) => row.unit === "RATIO")

  addSummarySheet(workbook, input)
  addAssetsSheet(workbook, input.assets)
  addSectorDistributionSheet(workbook, input.assets)
  addCriteriaSheet(workbook, "Kısıt Uyumu", constraintRows)
  addCriteriaSheet(workbook, "Risk Metrikleri", infoRows)

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
