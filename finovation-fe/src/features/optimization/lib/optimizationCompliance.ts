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
const EQUITY_WEIGHT_FLOOR = 85
const EQUITY_WEIGHT_CEILING = 95
const SINGLE_STOCK_MIN = 3
const SINGLE_STOCK_MAX = 10
const SECTOR_MAX = 30

export type ComplianceInput = {
  tppMinWeight: number
  tppMaxWeight: number
  stockCountMin: number
  stockCountMax: number
  keptAssetCount: number
  keptWeightSum: number
  forceAddedAssetCount: number
  excludedAssetCount: number
  currentEquityWeightPct: number | null
  maxSingleStockWeightPct: number
  minSingleStockWeightPct: number
  maxSectorWeightPct: number
  currentStockCount: number | null
  maxAdditions: number
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

  const guaranteedStockCount = input.keptAssetCount + input.forceAddedAssetCount
  const stockCountRangeStatus = rangeStatus(
    input.stockCountMin,
    input.stockCountMax,
    STOCK_COUNT_FLOOR,
    STOCK_COUNT_CEILING,
    STOCK_COUNT_MIN_RANGE_WIDTH,
  )
  const stockCountExceedsGuaranteed = guaranteedStockCount > input.stockCountMax
  const maxReachableStockCount =
    input.currentStockCount == null
      ? null
      : input.currentStockCount + input.maxAdditions
  const stockCountUnreachable =
    maxReachableStockCount != null && input.stockCountMin > maxReachableStockCount
  const stockCountStatus: ComplianceRowStatus =
    stockCountRangeStatus === "UYUMSUZ" ||
    stockCountExceedsGuaranteed ||
    stockCountUnreachable
      ? "UYUMSUZ"
      : "UYUMLU"

  const reservedWeight =
    input.keptWeightSum + input.forceAddedAssetCount * FORCE_ADD_MINIMUM_WEIGHT
  const keptWeightStatus: ComplianceRowStatus =
    reservedWeight > USABLE_EQUITY_WEIGHT_CEILING ? "UYUMSUZ" : "UYUMLU"

  const equityWeightStatus: ComplianceRowStatus =
    input.currentEquityWeightPct == null ||
    (input.currentEquityWeightPct >= EQUITY_WEIGHT_FLOOR &&
      input.currentEquityWeightPct <= EQUITY_WEIGHT_CEILING)
      ? "UYUMLU"
      : "UYUMSUZ"

  const singleStockStatus: ComplianceRowStatus =
    input.maxSingleStockWeightPct > SINGLE_STOCK_MAX ||
    (input.minSingleStockWeightPct > 0 &&
      input.minSingleStockWeightPct < SINGLE_STOCK_MIN)
      ? "UYUMSUZ"
      : "UYUMLU"

  const sectorStatus: ComplianceRowStatus =
    input.maxSectorWeightPct > SECTOR_MAX ? "UYUMSUZ" : "UYUMLU"

  const rows: ComplianceRow[] = [
    {
      key: "equity-weight",
      label: "Hisse toplam ağırlığı",
      status: equityWeightStatus,
      detail:
        input.currentEquityWeightPct == null
          ? "İzahname %85–%95 aralığını zorunlu kılar"
          : equityWeightStatus === "UYUMLU"
            ? `Mevcut %${input.currentEquityWeightPct} — izahname %85–%95 aralığında`
            : `Mevcut %${input.currentEquityWeightPct} — izahname %85–%95 aralığı dışında`,
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
        stockCountRangeStatus === "UYUMSUZ"
          ? "Sistem sınırı 16–30 arasında, aralık genişliği en az 5 hisse olmalı"
          : stockCountExceedsGuaranteed
            ? `${guaranteedStockCount} hisse (sabit + zorunlu) seçilen ${input.stockCountMax} üst sınırını aşıyor`
            : stockCountUnreachable
              ? `Fonda şu an ${input.currentStockCount} hisse var, en fazla ${input.maxAdditions} yeni hisse eklenebiliyor (ulaşılabilir üst sınır ${maxReachableStockCount}) — hedef alt sınır ${input.stockCountMin}'e ulaşılamaz. Hisse sayısı alt sınırını ${maxReachableStockCount} veya altına düşürün.`
              : `${input.stockCountMin}–${input.stockCountMax} arasında`,
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
      status: singleStockStatus,
      detail:
        input.keptAssetCount === 0
          ? "Korunacak hisse seçilmedi"
          : singleStockStatus === "UYUMLU"
            ? `Korunacak hisseleriniz %${input.minSingleStockWeightPct.toFixed(1)}–%${input.maxSingleStockWeightPct.toFixed(1)} arasında — izahname %3–%10 aralığında`
            : input.maxSingleStockWeightPct > SINGLE_STOCK_MAX
              ? `Korumak istediğiniz bir hissenin ağırlığı %${input.maxSingleStockWeightPct.toFixed(1)} — üst limit %10 aşılıyor`
              : `Korumak istediğiniz bir hissenin ağırlığı %${input.minSingleStockWeightPct.toFixed(1)} — alt limit %3'ün altında`,
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
      status: sectorStatus,
      detail:
        input.keptAssetCount === 0
          ? "Korunacak hisse seçilmedi"
          : sectorStatus === "UYUMLU"
            ? `Korunacak hisselerde en yüksek sektör payı %${input.maxSectorWeightPct.toFixed(1)} — üst limit %30`
            : `Korunacak hisselerde bir sektörün toplam ağırlığı %${input.maxSectorWeightPct.toFixed(1)} — üst limit %30 aşılıyor`,
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
