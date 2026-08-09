import { Workbook } from "exceljs"

import {
  formatDateTime,
  REQUEST_STATUS_LABELS,
} from "@/features/optimization/lib/optimizationExportLabels"
import type { OptimizationLogEntry } from "@/features/optimization/model/optimizationSchemas"

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF0F766A" },
}
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } }

export async function buildOptimizationLogsExcel(
  logs: OptimizationLogEntry[],
): Promise<Workbook> {
  const workbook = new Workbook()
  workbook.creator = "Finovation"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("İşlem Logları")
  sheet.columns = [
    { header: "Tarih ve Saat", key: "createdAt", width: 20 },
    { header: "Fon", key: "fundName", width: 28 },
    { header: "Kullanıcı", key: "requestedByUsername", width: 20 },
    { header: "Sonuç", key: "status", width: 16 },
    { header: "İstek No", key: "requestId", width: 10 },
  ]
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  })

  for (const log of logs) {
    sheet.addRow({
      createdAt: formatDateTime(log.createdAt),
      fundName: log.fundName,
      requestedByUsername: log.requestedByUsername ?? "—",
      status: REQUEST_STATUS_LABELS[log.status] ?? log.status,
      requestId: log.requestId,
    })
  }

  return workbook
}

export async function downloadOptimizationLogsExcel(
  logs: OptimizationLogEntry[],
): Promise<void> {
  const workbook = await buildOptimizationLogsExcel(logs)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "islem-loglari.xlsx"
  link.click()
  URL.revokeObjectURL(url)
}
