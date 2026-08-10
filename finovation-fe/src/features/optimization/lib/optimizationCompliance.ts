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
const MAX_WEIGHT_CHANGE_PER_ASSET_PCT = 3
const MAX_REMOVALS = 3

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
  heldExcludedAssetCount: number
  maxExcludedHeldAssetWeightPct: number
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
  const projectedStockCount =
    input.currentStockCount == null
      ? null
      : input.currentStockCount -
        input.heldExcludedAssetCount +
        input.forceAddedAssetCount
  const projectedStockCountOutOfRange =
    projectedStockCount != null &&
    (projectedStockCount < input.stockCountMin ||
      projectedStockCount > input.stockCountMax)
  const stockCountStatus: ComplianceRowStatus =
    stockCountRangeStatus === "UYUMSUZ" || stockCountExceedsGuaranteed
      ? "UYUMSUZ"
      : projectedStockCountOutOfRange
        ? "DIKKAT"
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

  const excludedWeightChangeExceeded =
    input.maxExcludedHeldAssetWeightPct > MAX_WEIGHT_CHANGE_PER_ASSET_PCT
  const excludedRemovalsExceeded = input.heldExcludedAssetCount > MAX_REMOVALS
  const forcedExcludedStatus: ComplianceRowStatus =
    excludedWeightChangeExceeded || excludedRemovalsExceeded
      ? "UYUMSUZ"
      : "UYUMLU"

  const rows: ComplianceRow[] = [
    {
      key: "equity-weight",
      label: "Hisse Toplam Ağırlığı",
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
      label: "TPP Aralığı",
      status: tppStatus,
      detail:
        tppStatus === "UYUMLU"
          ? `%${input.tppMinWeight}–%${input.tppMaxWeight} aralığında`
          : "İzahname %5–%15 arasında, aralık genişliği en az 3 puan olmalı",
    },
    {
      key: "stock-count",
      label: "Hisse Sayısı",
      status: stockCountStatus,
      detail:
        stockCountRangeStatus === "UYUMSUZ"
          ? "Sistem sınırı 16–30 arasında, aralık genişliği en az 5 hisse olmalı"
          : stockCountExceedsGuaranteed
            ? `${guaranteedStockCount} hisse (sabit + zorunlu) seçilen ${input.stockCountMax} üst sınırını aşıyor`
            : projectedStockCountOutOfRange
              ? `Mevcut fon B'den ${input.heldExcludedAssetCount} çıkarma, D'den ${input.forceAddedAssetCount} zorunlu eklemeyle ${projectedStockCount} hisseye ${
                  projectedStockCount != null &&
                  input.currentStockCount != null &&
                  projectedStockCount > input.currentStockCount
                    ? "çıkıyor"
                    : "düşüyor"
                }, seçtiğiniz ${input.stockCountMin}–${input.stockCountMax} aralığının dışında kalıyor — optimizasyon yine de diğer hisselerle aralığı tutturabilir`
              : `${input.stockCountMin}–${input.stockCountMax} arasında`,
    },
    {
      key: "kept-assets",
      label: "Sabit Tutulan Hisseler",
      status: keptWeightStatus,
      detail:
        keptWeightStatus === "UYUMLU"
          ? `${input.keptAssetCount} hisse mevcut ağırlığıyla sabitlendi (toplam %${input.keptWeightSum.toFixed(0)})`
          : "Sabit + zorunlu eklenecek hisselerin ağırlığı kullanılabilir hisse ağırlığını (%95) aşıyor",
    },
    {
      key: "single-stock-weight",
      label: "Tek Hisse Ağırlığı",
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
      label: "Zorunlu ve Hariç Tutulan Hisseler",
      status: forcedExcludedStatus,
      locked: forcedExcludedStatus === "UYUMLU",
      detail: excludedWeightChangeExceeded
        ? `Hariç tutulan bir hissenin mevcut ağırlığı %${input.maxExcludedHeldAssetWeightPct.toFixed(1)} — tek optimizasyonda bir hissenin ağırlığı en fazla %${MAX_WEIGHT_CHANGE_PER_ASSET_PCT} değişebilir, bu hisse çıkarılamaz`
        : excludedRemovalsExceeded
          ? `${input.heldExcludedAssetCount} mevcut hisse çıkarılmak isteniyor — tek optimizasyonda en fazla ${MAX_REMOVALS} hisse çıkarılabilir`
          : `${input.forceAddedAssetCount} hisse zorunlu eklenecek · ${input.excludedAssetCount} hisse hariç tutuldu; zorunlu hisseler için en az %3 ağırlık ayrılır`,
    },
    {
      key: "sector-concentration",
      label: "Sektör Yoğunlaşması",
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
    : rows.some((row) => row.status === "DIKKAT")
      ? "DIKKAT"
      : "UYUMLU"

  rows.push({
    key: "overall",
    label: "Toplam Uygulanabilirlik",
    status: overallStatus,
    detail:
      overallStatus === "UYUMLU"
        ? "Optimizasyon çalıştırılabilir"
        : overallStatus === "DIKKAT"
          ? "Turuncu satırlar bilgilendirme amaçlıdır, optimizasyon yine de çalıştırılabilir"
          : "Kırmızı durumlar giderilmeden optimizasyon çalıştırılamaz",
  })

  return rows
}

export function isComplianceReady(rows: ComplianceRow[]): boolean {
  return rows.every((row) => row.status !== "UYUMSUZ")
}
