import type {
  ComplianceRow,
  ComplianceRowStatus,
} from "@/features/optimization/model/optimizationForm.types"

const TPP_FLOOR = 5
const TPP_CEILING = 15
const TPP_MIN_RANGE_WIDTH = 3
const STOCK_COUNT_FLOOR = 16
const STOCK_COUNT_CEILING = 30
const STOCK_COUNT_MIN_RANGE_WIDTH = 5
const USABLE_EQUITY_WEIGHT_CEILING = 95
const FORCE_ADD_MINIMUM_WEIGHT = 3

export type ComplianceInput = {
  tppMinWeight: number
  tppMaxWeight: number
  stockCountMin: number
  stockCountMax: number
  keptAssetCount: number
  keptWeightSum: number
  forceAddedAssetCount: number
  excludedAssetCount: number
}

function rangeStatus(
  min: number,
  max: number,
  floor: number,
  ceiling: number,
  minWidth: number,
): ComplianceRowStatus {
  if (
    Number.isNaN(min) ||
    Number.isNaN(max) ||
    min < floor ||
    max > ceiling ||
    min > max ||
    max - min < minWidth
  ) {
    return "UYUMSUZ"
  }
  return "UYUMLU"
}

export function buildComplianceRows(input: ComplianceInput): ComplianceRow[] {
  const tppStatus = rangeStatus(
    input.tppMinWeight,
    input.tppMaxWeight,
    TPP_FLOOR,
    TPP_CEILING,
    TPP_MIN_RANGE_WIDTH,
  )
  const stockCountStatus = rangeStatus(
    input.stockCountMin,
    input.stockCountMax,
    STOCK_COUNT_FLOOR,
    STOCK_COUNT_CEILING,
    STOCK_COUNT_MIN_RANGE_WIDTH,
  )
  const reservedWeight =
    input.keptWeightSum + input.forceAddedAssetCount * FORCE_ADD_MINIMUM_WEIGHT
  const keptWeightStatus: ComplianceRowStatus =
    reservedWeight > USABLE_EQUITY_WEIGHT_CEILING ? "UYUMSUZ" : "UYUMLU"

  const rows: ComplianceRow[] = [
    {
      key: "equity-weight",
      label: "Hisse toplam ağırlığı",
      status: "UYUMLU",
      detail: "İzahname %85–%95 aralığını zorunlu kılar",
    },
    {
      key: "tpp-range",
      label: "TPP aralığı",
      status: tppStatus,
      detail:
        tppStatus === "UYUMLU"
          ? `%${input.tppMinWeight}–%${input.tppMaxWeight} aralığında`
          : "İzahname %5–%15 arasında, aralık genişliği en az 3 puan olmalı",
    },
    {
      key: "stock-count",
      label: "Hisse sayısı",
      status: stockCountStatus,
      detail:
        stockCountStatus === "UYUMLU"
          ? `${input.stockCountMin}–${input.stockCountMax} arasında`
          : "Sistem sınırı 16–30 arasında, aralık genişliği en az 5 hisse olmalı",
    },
    {
      key: "kept-assets",
      label: "Sabit tutulan hisseler",
      status: keptWeightStatus,
      detail:
        keptWeightStatus === "UYUMLU"
          ? `${input.keptAssetCount} hisse mevcut ağırlığıyla sabitlendi (toplam %${input.keptWeightSum.toFixed(0)})`
          : "Sabit + zorunlu eklenecek hisselerin ağırlığı kullanılabilir hisse ağırlığını (%95) aşıyor",
    },
    {
      key: "single-stock-weight",
      label: "Tek hisse ağırlığı",
      status: "UYUMLU",
      detail: "Üst limit %10 — izahname %3–%10 aralığında",
    },
    {
      key: "forced-excluded-assets",
      label: "Zorunlu ve hariç tutulan hisseler",
      status: "UYUMLU",
      detail: `${input.forceAddedAssetCount} hisse zorunlu eklenecek · ${input.excludedAssetCount} hisse hariç tutuldu; zorunlu hisseler için en az %3 ağırlık ayrılır`,
    },
    {
      key: "sector-concentration",
      label: "Sektör yoğunlaşması",
      status: "UYUMLU",
      detail: "Üst limit %30 aşılmıyor",
    },
  ]

  const overallStatus: ComplianceRowStatus = rows.some(
    (row) => row.status === "UYUMSUZ",
  )
    ? "UYUMSUZ"
    : "UYUMLU"

  rows.push({
    key: "overall",
    label: "Toplam uygulanabilirlik",
    status: overallStatus,
    detail:
      overallStatus === "UYUMLU"
        ? "Optimizasyon çalıştırılabilir"
        : "Kırmızı durumlar giderilmeden optimizasyon çalıştırılamaz",
  })

  return rows
}

export function isComplianceReady(rows: ComplianceRow[]): boolean {
  return rows.every((row) => row.status !== "UYUMSUZ")
}
