import { z } from "zod"

export const fundCurrencyOptionSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
})

export const modelUniverseAssetSchema = z
  .object({
    assetCode: z.string().min(1),
    displayName: z.string().nullish(),
    sectorName: z.string().nullish(),
  })
  .transform((asset) => ({
    assetCode: asset.assetCode,
    sectorName: asset.sectorName,
    displayName:
      asset.displayName && asset.displayName.trim()
        ? asset.displayName
        : asset.assetCode,
  }))

export const fundDesignInitPageSchema = z.enum([
  "START",
  "STRATEGY",
  "ANALYSIS",
  "ALTERNATIVES",
  "EDIT",
  "APPROVAL",
])

export const fundDraftInitLimitsSchema = z.object({
  minLiquidityTargetPct: z.coerce.number().int(),
  maxLiquidityTargetPct: z.coerce.number().int(),
  minTppRangePct: z.coerce.number().int(),
  minStockCount: z.coerce.number().int(),
  maxStockCount: z.coerce.number().int(),
  minStockCountRange: z.coerce.number().int(),
  minSingleStockMaxPct: z.coerce.number().int(),
  maxSingleStockMaxPct: z.coerce.number().int(),
  minEquityWeightPct: z.coerce.number().int(),
  maxEquityWeightPct: z.coerce.number().int(),
  sectorMaxPct: z.coerce.number().finite().positive(),
  aboveThresholdPct: z.coerce.number().finite().positive(),
  aboveThresholdSumMax: z.coerce.number().finite().positive(),
  maxAssetPreferences: z.coerce.number().int(),
})

export const fundDraftSummarySchema = z.object({
  draftId: z.string().uuid(),
  name: z.string().nullable(),
  currentStep: z.number().nullable(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELED"]),
  updatedAt: z.string(),
}).transform((draft) => ({
  ...draft,
  name: draft.name?.trim() || "İsimsiz Fon Taslağı",
}))

export const createdFundDraftSchema = z.object({
  draftId: z.string().uuid(),
  currentStep: z.coerce.number().int().optional(),
})

export const managementApproachSchema = z.enum([
  "ATTACK",
  "BALANCED",
  "PROTECTIVE",
])

const optionalInt = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null
  return value
}, z.coerce.number().int().nullable())

export const fundDraftSchema = z.object({
  draftId: z.string().uuid(),
  name: z.string().nullable().optional(),
  managementApproach: managementApproachSchema.nullish(),
  tppMinPct: optionalInt,
  tppMaxPct: optionalInt,
  preferredTppPct: optionalInt,
  minStockCount: optionalInt,
  maxStockCount: optionalInt,
  equityMinPct: optionalInt,
  equityMaxPct: optionalInt,
  singleStockMaxPct: optionalInt,
  draftVersion: optionalInt,
  currentStep: optionalInt,
  excludedAssetCodes: z.array(z.string()).optional().default([]),
  forcedAssetCodes: z.array(z.string()).optional().default([]),
  unitPrice: z.coerce.number().nullish(),
  initialPortfolioSize: z.coerce.number().nullish(),
  liquidityTargetPct: optionalInt,
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
})

export const fundDraftPortfolioRulesSchema = z.object({
  draftId: z.string().uuid(),
  managementApproach: managementApproachSchema,
  tppMinPct: z.coerce.number().int(),
  tppMaxPct: z.coerce.number().int(),
  preferredTppPct: z.coerce.number().int(),
  minStockCount: z.coerce.number().int(),
  maxStockCount: z.coerce.number().int(),
  currentStep: z.coerce.number().int().optional(),
  excludedAssetCodes: z.array(z.string()).optional().default([]),
  forcedAssetCodes: z.array(z.string()).optional().default([]),
})

export const fundDraftStartInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("START"),
  currencies: z.array(fundCurrencyOptionSchema).min(1),
  defaultCurrency: z.string().min(1),
  minInitialPortfolioSize: z.coerce.number().finite().positive(),
  maxInitialPortfolioSize: z.coerce.number().finite().positive(),
  minUnitPrice: z.coerce.number().finite().positive(),
  maxUnitPrice: z.coerce.number().finite().positive(),
})

export const fundDraftStrategyInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("STRATEGY"),
  draft: fundDraftSchema,
  modelUniverse: z.array(modelUniverseAssetSchema),
})

export const fundDraftAnalysisInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("ANALYSIS"),
  draft: fundDraftSchema,
  modelUniverse: z.array(modelUniverseAssetSchema),
})

export const fundDraftAlternativesInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("ALTERNATIVES"),
})

export const fundDraftEditInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("EDIT"),
  draft: fundDraftSchema,
  modelUniverse: z.array(modelUniverseAssetSchema),
})

export const fundDraftApprovalInitSchema = fundDraftInitLimitsSchema.extend({
  page: z.literal("APPROVAL"),
  draft: fundDraftSchema,
})

export const fundDraftInitSchema = z.discriminatedUnion("page", [
  fundDraftStartInitSchema,
  fundDraftStrategyInitSchema,
  fundDraftAnalysisInitSchema,
  fundDraftAlternativesInitSchema,
  fundDraftEditInitSchema,
  fundDraftApprovalInitSchema,
])

export type FundCurrencyOption = z.infer<typeof fundCurrencyOptionSchema>
export type FundDraftInitLimits = z.infer<typeof fundDraftInitLimitsSchema>
export type FundDesignInitPage = z.infer<typeof fundDesignInitPageSchema>
export type FundDraftInit = z.infer<typeof fundDraftInitSchema>
export type FundDraftStartInit = z.infer<typeof fundDraftStartInitSchema>
export type FundDraftStrategyInit = z.infer<typeof fundDraftStrategyInitSchema>
export type FundDraftApprovalInit = z.infer<typeof fundDraftApprovalInitSchema>
export type CreatedFundDraft = z.infer<typeof createdFundDraftSchema>
export type FundDraft = z.infer<typeof fundDraftSchema>
export type FundDraftPortfolioRules = z.infer<
  typeof fundDraftPortfolioRulesSchema
>
export type ModelUniverseAsset = z.infer<typeof modelUniverseAssetSchema>
export type FundDraftSummary = z.infer<typeof fundDraftSummarySchema>

export const FUND_TYPE_LABELS = {
  EQUITY_INTENSIVE: "Hisse Senedi Yoğun Fon",
} as const
