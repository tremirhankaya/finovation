import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"

import robotoBoldFontUrl from "@/features/optimization/assets/fonts/Roboto-Bold.ttf"
import robotoRegularFontUrl from "@/features/optimization/assets/fonts/Roboto-Regular.ttf"
import type { WorkingPortfolioResponse } from "@/features/fund-design/api/fundDraftApi"

const FONT_FAMILY = "Roboto"

function toBase64(buffer: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function registerTurkishFont(doc: jsPDF): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetch(robotoRegularFontUrl).then((response) => response.arrayBuffer()),
    fetch(robotoBoldFontUrl).then((response) => response.arrayBuffer()),
  ])

  doc.addFileToVFS("Roboto-Regular.ttf", toBase64(regular))
  doc.addFont("Roboto-Regular.ttf", FONT_FAMILY, "normal")
  doc.addFileToVFS("Roboto-Bold.ttf", toBase64(bold))
  doc.addFont("Roboto-Bold.ttf", FONT_FAMILY, "bold")
  doc.setFont(FONT_FAMILY, "normal")
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—"
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatMoney(value: number | null): string {
  if (value == null) return "—"
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
}

export async function downloadFundSummaryPdf(input: {
  fundName: string
  initialPortfolioSize: number | null
  portfolio: WorkingPortfolioResponse
}): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  await registerTurkishFont(doc)

  doc.setFont(FONT_FAMILY, "bold")
  doc.setFontSize(18)
  doc.text("Fon Özeti", 14, 18)
  doc.setFont(FONT_FAMILY, "normal")
  doc.setFontSize(10)
  doc.setTextColor(83, 104, 125)
  doc.text(input.fundName, 14, 25)
  doc.text(
    `Oluşturulma tarihi: ${new Date().toLocaleDateString("tr-TR")}`,
    14,
    31,
  )

  autoTable(doc, {
    startY: 38,
    theme: "grid",
    styles: { font: FONT_FAMILY, fontSize: 9, cellPadding: 3 },
    headStyles: { font: FONT_FAMILY, fontStyle: "bold", fillColor: [14, 143, 118] },
    head: [["Hisse oranı", "TPP oranı", "Hisse sayısı", "Sektör sayısı", "Portföy büyüklüğü"]],
    body: [[
      formatPercent(input.portfolio.equityWeightPct),
      formatPercent(input.portfolio.tppWeightPct),
      String(input.portfolio.stockCount ?? "—"),
      String(input.portfolio.sectorCount ?? "—"),
      formatMoney(input.initialPortfolioSize),
    ]],
  })

  autoTable(doc, {
    startY: 59,
    theme: "grid",
    styles: { font: FONT_FAMILY, fontSize: 8.5, cellPadding: 2.7 },
    headStyles: { font: FONT_FAMILY, fontStyle: "bold", fillColor: [15, 31, 60] },
    head: [["Kod", "Varlık", "Sektör", "Tür", "Ağırlık"]],
    body: input.portfolio.assets.map((asset) => [
      asset.asset_code,
      asset.display_name?.trim() || asset.asset_code,
      asset.sector_name?.trim() || "—",
      asset.asset_type === "TPP" ? "TPP" : "Hisse senedi",
      formatPercent(asset.weight),
    ]),
  })

  const slug = input.fundName
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  doc.save(`fon-ozeti-${slug || "fon"}.pdf`)
}
