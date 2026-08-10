import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"

import robotoBoldFontUrl from "@/features/optimization/assets/fonts/Roboto-Bold.ttf"
import robotoRegularFontUrl from "@/features/optimization/assets/fonts/Roboto-Regular.ttf"
import {
  formatDateTime,
  formatDecisionDateTime,
  RISK_PROFILE_LABELS,
} from "@/features/optimization/lib/optimizationExportLabels"
import {
  CRITERIA_STATUS_LABELS,
  formatCriteriaDelta,
  formatCriteriaValue,
  type CriteriaRow,
} from "@/features/optimization/lib/optimizationCriteriaRows"
import { buildResultCategories } from "@/features/optimization/lib/optimizationResultCategories"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

const FONT_FAMILY = "Roboto"
const TABLE_FONT = { font: FONT_FAMILY }
const TABLE_HEAD_FONT = { font: FONT_FAMILY, fontStyle: "bold" as const }

function formatWeight(value: number | null): string {
  if (value == null) return "—"
  return `%${value.toFixed(1).replace(/\.0$/, "")}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function loadFontBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

async function registerTurkishFont(doc: jsPDF): Promise<void> {
  const [regular, bold] = await Promise.all([
    loadFontBase64(robotoRegularFontUrl),
    loadFontBase64(robotoBoldFontUrl),
  ])

  doc.addFileToVFS("Roboto-Regular.ttf", regular)
  doc.addFont("Roboto-Regular.ttf", FONT_FAMILY, "normal")
  doc.addFileToVFS("Roboto-Bold.ttf", bold)
  doc.addFont("Roboto-Bold.ttf", FONT_FAMILY, "bold")
  doc.setFont(FONT_FAMILY, "normal")
}

export type OptimizationPdfExportInput = {
  fundName: string
  request: OptimizationRequestResponse
  assets: OptimizationResultAsset[]
  criteriaRows: CriteriaRow[]
}

function nextY(doc: DocWithAutoTable, fallback: number): number {
  return (doc.lastAutoTable?.finalY ?? fallback) + 10
}

function heading(doc: DocWithAutoTable, text: string, y: number): void {
  doc.setFont(FONT_FAMILY, "bold")
  doc.setFontSize(12)
  doc.text(text, 14, y)
  doc.setFont(FONT_FAMILY, "normal")
}

function criteriaRowToLine(row: CriteriaRow): string[] {
  return [
    row.label,
    formatCriteriaValue(row.currentValue, row.unit),
    formatCriteriaValue(row.proposedValue, row.unit),
    formatCriteriaDelta(row.currentValue, row.proposedValue, row.unit).text,
    CRITERIA_STATUS_LABELS[row.status] ?? row.status,
    row.detail,
  ]
}

export async function buildOptimizationResultPdf(
  input: OptimizationPdfExportInput,
): Promise<jsPDF> {
  const doc = new jsPDF() as DocWithAutoTable
  await registerTurkishFont(doc)

  doc.setFont(FONT_FAMILY, "bold")
  doc.setFontSize(16)
  doc.text("Fon Optimizasyonu — Onay Özeti", 14, 18)
  doc.setFont(FONT_FAMILY, "normal")

  autoTable(doc, {
    startY: 24,
    theme: "plain",
    styles: { ...TABLE_FONT, fontSize: 9 },
    columnStyles: { 0: { ...TABLE_HEAD_FONT, cellWidth: 45 } },
    body: [
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
    ],
  })

  const categories = buildResultCategories(input.assets)
  const countFor = (key: string) =>
    categories.find((category) => category.key === key)?.count ?? 0
  const overriddenCount = input.assets.filter(
    (asset) => asset.manuallyOverridden,
  ).length

  let y = nextY(doc, 24)
  heading(doc, "Portföy Değişim Özeti", y)
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    styles: { ...TABLE_FONT, fontSize: 9, halign: "center" },
    headStyles: { ...TABLE_HEAD_FONT, fillColor: [15, 118, 110] },
    head: [["Artırılan", "Azaltılan", "Sabit Kalan", "Manuel Değiştirilen"]],
    body: [
      [
        String(countFor("INCREASED")),
        String(countFor("DECREASED")),
        String(countFor("LOCKED")),
        String(overriddenCount),
      ],
    ],
  })

  const constraintRows = input.criteriaRows.filter(
    (row) => row.unit !== "RATIO",
  )
  const infoRows = input.criteriaRows.filter((row) => row.unit === "RATIO")

  y = nextY(doc, y)
  heading(doc, "Kısıt/İzahname Uyum Özeti", y)
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    styles: { ...TABLE_FONT, fontSize: 8.5 },
    headStyles: { ...TABLE_HEAD_FONT, fillColor: [15, 118, 110] },
    head: [
      ["Kriter", "Mevcut Fon", "Optimize Edilmiş", "Değişim", "Durum", "Detay"],
    ],
    body: constraintRows.map(criteriaRowToLine),
  })

  y = nextY(doc, y)
  heading(doc, "Risk ve Getiri Metrikleri", y)
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    styles: { ...TABLE_FONT, fontSize: 8.5 },
    headStyles: { ...TABLE_HEAD_FONT, fillColor: [15, 118, 110] },
    head: [
      ["Metrik", "Mevcut", "Önerilen", "Değişim", "Durum", "Detay"],
    ],
    body: infoRows.map(criteriaRowToLine),
  })

  doc.addPage()
  heading(doc, "Varlık Bazlı Karşılaştırma", 18)
  autoTable(doc, {
    startY: 22,
    theme: "grid",
    styles: { ...TABLE_FONT, fontSize: 8 },
    headStyles: { ...TABLE_HEAD_FONT, fillColor: [15, 118, 110] },
    head: [["Kod", "Ad", "Mevcut", "Önerilen", "Final"]],
    body: input.assets.map((asset) => [
      asset.assetCode,
      asset.name,
      formatWeight(asset.currentWeight),
      formatWeight(asset.proposedWeight),
      formatWeight(asset.finalWeight ?? asset.proposedWeight),
    ]),
  })

  const rationales = input.assets.filter((asset) => asset.rationale)
  if (rationales.length > 0) {
    const rationaleY = nextY(doc, 22)
    heading(doc, "Model Gerekçeleri", rationaleY)
    autoTable(doc, {
      startY: rationaleY + 4,
      theme: "grid",
      styles: { ...TABLE_FONT, fontSize: 8.5 },
      headStyles: { ...TABLE_HEAD_FONT, fillColor: [15, 118, 110] },
      head: [["Varlık", "Gerekçe"]],
      body: rationales.map((asset) => [asset.name, asset.rationale ?? ""]),
    })
  }

  return doc
}

export async function downloadOptimizationResultPdf(
  input: OptimizationPdfExportInput,
): Promise<void> {
  const doc = await buildOptimizationResultPdf(input)
  const fundSlug = input.fundName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  doc.save(`optimizasyon-${fundSlug || "fon"}-${input.request.id}.pdf`)
}
