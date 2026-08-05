export type PricePeriod = "1W" | "1M" | "3M" | "6M" | "1Y"

export type FundOption = {
  id: string
  name: string
  type: string
}

export type PricePoint = {
  date: string
  value: number
}

export type IndicatorUnit = "PERCENT" | "RATIO"

export type TechnicalIndicator = {
  code: string
  label: string
  value: number | null
  unit: IndicatorUnit
  tone?: "positive" | "negative" | "neutral"
}

export type PeriodReturn = {
  period: "1M" | "3M" | "6M"
  label: string
  value: number | null
}

export type FundPosition = {
  assetId: string
  symbol: string
  name: string
  sectorName: string | null
  weightPercentage: number
}

export type SectorAllocation = {
  sectorId: string
  sectorName: string
  weightPercentage: number
}

export type FundMonitoringSnapshot = {
  fund: FundOption
  asOfDate: string
  currency: string
  currentSharePrice: number
  dailyChangePercentage: number
  priceHistory: Partial<Record<PricePeriod, PricePoint[]>>
  technicalIndicators: TechnicalIndicator[]
  periodReturns: PeriodReturn[]
  positions: FundPosition[]
  sectorAllocations: SectorAllocation[]
}

export const PRICE_PERIODS: ReadonlyArray<{
  value: PricePeriod
  label: string
}> = [
  { value: "1W", label: "1H" },
  { value: "1M", label: "1A" },
  { value: "3M", label: "3A" },
  { value: "6M", label: "6A" },
  { value: "1Y", label: "1Y" },
]
