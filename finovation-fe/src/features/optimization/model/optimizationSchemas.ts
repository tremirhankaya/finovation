import { z } from "zod"

export const riskProfileSchema = z.enum([
  "AGGRESSIVE",
  "BALANCED",
  "CONSERVATIVE",
])

export const requestStatusSchema = z.enum([
  "PREPARING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "APPROVED",
  "REJECTED",
])

export const assetPreferenceTypeSchema = z.enum([
  "KEEP",
  "EXCLUDE",
  "CANDIDATE_ADD",
  "FORCE_ADD",
])

export const optimizationRequestResponseSchema = z.object({
  id: z.number(),
  fundId: z.uuid(),
  dataTimestamp: z.iso.datetime({ local: true }).nullable(),
  modelVersion: z.string().nullable(),
  requestedByUserId: z.number().nullable(),
  requestedByUsername: z.string().nullable(),
  riskProfile: riskProfileSchema,
  status: requestStatusSchema,
  maxAdditions: z.number().nullable(),
  tppMinWeight: z.number().nullable(),
  tppMaxWeight: z.number().nullable(),
  stockCountMin: z.number().nullable(),
  stockCountMax: z.number().nullable(),
  startedAt: z.iso.datetime({ local: true }).nullable(),
  completedAt: z.iso.datetime({ local: true }).nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime({ local: true }),
  updatedAt: z.iso.datetime({ local: true }),
})

export const optimizationRequestListResponseSchema = z.array(
  optimizationRequestResponseSchema,
)

export const assetPreferenceRequestSchema = z.object({
  assetCode: z.string().min(1),
  preferenceType: assetPreferenceTypeSchema,
  currentWeight: z.number().nullable(),
})

export const createOptimizationRequestSchema = z.object({
  fundId: z.uuid(),
  riskProfile: riskProfileSchema,
  assetPreferences: z.array(assetPreferenceRequestSchema),
  tppMinWeight: z.number(),
  tppMaxWeight: z.number(),
  stockCountMin: z.number(),
  stockCountMax: z.number(),
  maxAdditions: z.number(),
})

export const fundTypeSchema = z.enum(["EQUITY_INTENSIVE"])

export const optimizableFundResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: fundTypeSchema,
  active: z.boolean(),
  lastOptimizationDate: z.iso.date().nullable(),
  stockCount: z.number(),
  sectorCount: z.number(),
  equityWeightPercent: z.number(),
  tppWeightPercent: z.number(),
})

export const optimizableFundListResponseSchema = z.array(
  optimizableFundResponseSchema,
)

export const investmentUniverseAssetResponseSchema = z.object({
  assetCode: z.string(),
  name: z.string(),
  sectorName: z.string().nullable(),
})

export const investmentUniverseResponseSchema = z.array(
  investmentUniverseAssetResponseSchema,
)

export const optimizationLogEntryResponseSchema = z.object({
  requestId: z.number(),
  fundId: z.uuid(),
  fundName: z.string(),
  requestedByUsername: z.string().nullable(),
  status: requestStatusSchema,
  createdAt: z.iso.datetime({ local: true }),
  completedAt: z.iso.datetime({ local: true }).nullable(),
  updatedAt: z.iso.datetime({ local: true }),
  resultAvailable: z.boolean(),
})

export const optimizationLogListResponseSchema = z.array(
  optimizationLogEntryResponseSchema,
)

export type RiskProfile = z.infer<typeof riskProfileSchema>
export type RequestStatus = z.infer<typeof requestStatusSchema>
export type AssetPreferenceType = z.infer<typeof assetPreferenceTypeSchema>
export type OptimizationRequestResponse = z.infer<typeof optimizationRequestResponseSchema>
export type AssetPreferenceRequest = z.infer<typeof assetPreferenceRequestSchema>
export type CreateOptimizationRequestPayload = z.infer<typeof createOptimizationRequestSchema>
export type InvestmentUniverseAssetResponse = z.infer<typeof investmentUniverseAssetResponseSchema>
export type FundType = z.infer<typeof fundTypeSchema>
export type OptimizableFundResponse = z.infer<typeof optimizableFundResponseSchema>
export type OptimizationLogEntry = z.infer<typeof optimizationLogEntryResponseSchema>
