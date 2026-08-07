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
  fundId: z.number(),
  dataTimestamp: z.iso.datetime({ local: true }).nullable(),
  modelVersion: z.string().nullable(),
  requestedByUserId: z.number().nullable(),
  requestedByUsername: z.string().nullable(),
  riskProfile: riskProfileSchema,
  status: requestStatusSchema,
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
  fundId: z.number(),
  riskProfile: riskProfileSchema,
  assetPreferences: z.array(assetPreferenceRequestSchema),
  tppMinWeight: z.number(),
  tppMaxWeight: z.number(),
  stockCountMin: z.number(),
  stockCountMax: z.number(),
})

export type RiskProfile = z.infer<typeof riskProfileSchema>
export type RequestStatus = z.infer<typeof requestStatusSchema>
export type AssetPreferenceType = z.infer<typeof assetPreferenceTypeSchema>
export type OptimizationRequestResponse = z.infer<typeof optimizationRequestResponseSchema>
export type AssetPreferenceRequest = z.infer<typeof assetPreferenceRequestSchema>
export type CreateOptimizationRequestPayload = z.infer<typeof createOptimizationRequestSchema>
