import { z } from "zod"

export const resultActionTypeSchema = z.enum(["INCREASE", "DECREASE", "KEEP"])

export const resultAssetTypeSchema = z.enum(["EQUITY", "TPP"])

export const optimizationResultAssetSchema = z.object({
  assetCode: z.string(),
  name: z.string(),
  sectorName: z.string().nullable(),
  assetType: resultAssetTypeSchema,
  currentWeight: z.number(),
  proposedWeight: z.number(),
  finalWeight: z.number().nullable(),
  changeAmount: z.number(),
  actionType: resultActionTypeSchema,
  manuallyOverridden: z.boolean(),
  rationale: z.string().nullable(),
})

export const optimizationResultMetricSchema = z.object({
  key: z.string(),
  currentValue: z.number().nullable(),
  proposedValue: z.number().nullable(),
})

export const optimizationResultSchema = z.object({
  generatedAt: z.iso.datetime({ local: true }),
  assets: z.array(optimizationResultAssetSchema),
  metrics: z.array(optimizationResultMetricSchema),
})

export type ResultActionType = z.infer<typeof resultActionTypeSchema>
export type ResultAssetType = z.infer<typeof resultAssetTypeSchema>
export type OptimizationResultAsset = z.infer<typeof optimizationResultAssetSchema>
export type OptimizationResultMetric = z.infer<typeof optimizationResultMetricSchema>
export type OptimizationResult = z.infer<typeof optimizationResultSchema>
