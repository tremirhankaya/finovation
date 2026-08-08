import { z } from "zod"

const fundTypeSchema = z.enum(["EQUITY_INTENSIVE"])

export const fundSummaryResponseSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  type: fundTypeSchema,
  currency: z.string().length(3),
  inceptionDate: z.iso.date(),
})

const pricePointSchema = z.object({
  date: z.iso.date(),
  value: z.number().nonnegative(),
})

const technicalIndicatorSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  value: z.number().nullable(),
  unit: z.enum(["PERCENT", "RATIO"]),
  tone: z.enum(["positive", "negative", "neutral"]),
  description: z.string().min(1),
})

const benchmarkDefinitionSchema = z.object({
  name: z.string().min(1),
  components: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      weightPercentage: z.number().min(0).max(100),
    }),
  ),
})

const periodReturnSchema = z.object({
  period: z.enum(["1M", "3M", "6M", "1Y"]),
  label: z.string().min(1),
  value: z.number().nullable(),
})

const fundPositionSchema = z.object({
  assetId: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  sectorName: z.string().nullable(),
  weightPercentage: z.number().min(0).max(100),
})

const sectorAllocationSchema = z.object({
  sectorId: z.string().min(1),
  sectorName: z.string().min(1),
  weightPercentage: z.number().min(0).max(100),
})

const comparisonReturnsSchema = z
  .object({
    "1W": z.number().nullable(),
    "1M": z.number().nullable(),
    "3M": z.number().nullable(),
    "6M": z.number().nullable(),
    YTD: z.number().nullable(),
    "1Y": z.number().nullable(),
    "3Y": z.number().nullable(),
    "5Y": z.number().nullable(),
  })
  .partial()

const fundComparisonAssetSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  isFund: z.boolean(),
  returns: comparisonReturnsSchema,
})

export const fundMonitoringResponseSchema = z.object({
  fund: fundSummaryResponseSchema,
  asOfDate: z.iso.date(),
  currency: z.string().length(3),
  outstandingShares: z.number().positive(),
  currentSharePrice: z.number().nonnegative(),
  dailyChangePercentage: z.number(),
  priceHistory: z.object({
    "1W": z.array(pricePointSchema),
    "1M": z.array(pricePointSchema),
    "3M": z.array(pricePointSchema),
    "6M": z.array(pricePointSchema),
    "1Y": z.array(pricePointSchema),
  }),
  benchmark: benchmarkDefinitionSchema,
  technicalIndicators: z.array(technicalIndicatorSchema),
  periodReturns: z.array(periodReturnSchema),
  positions: z.array(fundPositionSchema),
  sectorAllocations: z.array(sectorAllocationSchema),
  comparisonAssets: z.array(fundComparisonAssetSchema).optional(),
})

export const fundSummaryListResponseSchema = z.array(fundSummaryResponseSchema)

export type FundSummaryResponse = z.infer<typeof fundSummaryResponseSchema>
export type FundMonitoringResponse = z.infer<typeof fundMonitoringResponseSchema>
