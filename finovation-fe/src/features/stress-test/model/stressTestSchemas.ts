import { z } from "zod"

export const stressTestAssetTypeSchema = z.enum([
    "EQUITY",
    "TPP",
])

export const stressTestFundResponseSchema = z.object({
    id: z.uuid(),
    name: z.string().min(1),
    type: z.string().min(1),
})

export const stressTestFundListResponseSchema = z.array(
    stressTestFundResponseSchema,
)

export const stressScenarioResponseSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
})

export const stressScenarioListResponseSchema = z.array(
    stressScenarioResponseSchema,
)

export const stressTestAssetResponseSchema = z.object({
    assetCode: z.string().min(1),
    assetType: stressTestAssetTypeSchema,
    weight: z.number().min(0).max(100),
    impact: z.number(),
    portfolioContribution: z.number(),
})

export const runStressTestResponseSchema = z.object({
    testId: z.uuid(),
    scenarioCode: z.string().min(1),
    scenarioName: z.string().min(1),
    asOfDate: z.iso.date(),
    portfolioImpact: z.number(),
    assets: z.array(stressTestAssetResponseSchema),
})

export const stressTestHistoryResponseSchema = z.object({
    testId: z.uuid(),
    scenarioCode: z.string().min(1),
    scenarioName: z.string().min(1),
    asOfDate: z.iso.date(),
    portfolioImpact: z.number(),
    createdAt: z.iso.datetime({ local: true }),
})

export const stressTestHistoryListResponseSchema = z.array(
    stressTestHistoryResponseSchema,
)

export const stressTestDetailResponseSchema = z.object({
    testId: z.uuid(),
    scenarioCode: z.string().min(1),
    scenarioName: z.string().min(1),
    asOfDate: z.iso.date(),
    portfolioImpact: z.number(),
    createdAt: z.iso.datetime({ local: true }),
    assets: z.array(stressTestAssetResponseSchema),
})

export type StressTestAssetType = z.infer<
    typeof stressTestAssetTypeSchema
>

export type StressScenarioResponse = z.infer<
    typeof stressScenarioResponseSchema
>

export type StressTestAssetResponse = z.infer<
    typeof stressTestAssetResponseSchema
>

export type RunStressTestResponse = z.infer<
    typeof runStressTestResponseSchema
>

export type StressTestHistoryResponse = z.infer<
    typeof stressTestHistoryResponseSchema
>

export type StressTestDetailResponse = z.infer<
    typeof stressTestDetailResponseSchema
>
export type StressTestFundResponse = z.infer<
    typeof stressTestFundResponseSchema
>