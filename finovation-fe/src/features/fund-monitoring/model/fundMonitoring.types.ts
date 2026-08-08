export type PricePeriod = "1W" | "1M" | "3M" | "6M" | "1Y"

export type ComparisonPeriod = "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y"

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
  description?: string
}

export type BenchmarkComponent = {
  code: string
  name: string
  weightPercentage: number
}

export type BenchmarkDefinition = {
  name: string
  components: BenchmarkComponent[]
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

export type FundComparisonAsset = {
  id: string

  code: string

  name: string

  color: string

  isFund?: boolean

  returns: Partial<Record<ComparisonPeriod, number | null>>
}

export type FundMonitoringSnapshot = {
  fund: FundOption

  asOfDate: string

  currency: string

  currentSharePrice: number

  dailyChangePercentage: number

  priceHistory: Partial<Record<PricePeriod, PricePoint[]>>
  benchmark: BenchmarkDefinition
  technicalIndicators: TechnicalIndicator[]
  periodReturns: PeriodReturn[]

  positions: FundPosition[]

  sectorAllocations: SectorAllocation[]

  comparisonAssets?: FundComparisonAsset[]
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

export const COMPARISON_PERIODS: ReadonlyArray<{
  value: ComparisonPeriod

  label: string

  columnLabel: string
}> = [
  { value: "1W", label: "Haftalık", columnLabel: "Haftalık Getiri" },

  { value: "1M", label: "Aylık", columnLabel: "Aylık Getiri" },

  { value: "3M", label: "3 Aylık", columnLabel: "3 Aylık Getiri" },

  { value: "6M", label: "6 Aylık", columnLabel: "6 Aylık Getiri" },

  {
    value: "YTD",

    label: "Yılbaşından İtibaren",

    columnLabel: "Yılbaşından İtibaren Getiri",
  },

  { value: "1Y", label: "1 Yıllık", columnLabel: "1 Yıllık Getiri" },

  { value: "3Y", label: "3 Yıllık", columnLabel: "3 Yıllık Getiri" },

  { value: "5Y", label: "5 Yıllık", columnLabel: "5 Yıllık Getiri" },
]
