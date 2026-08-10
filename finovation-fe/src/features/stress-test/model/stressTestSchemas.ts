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
export const stressTestPathPointResponseSchema = z.object({
    date: z.iso.date(),
    dayIndex: z.number().int().nonnegative(),
    closeValue: z.number(),
    impact: z.number(),
})

export const stressTestAssetPathResponseSchema = z.object({
    assetCode: z.string().min(1),
    assetType: stressTestAssetTypeSchema,
    points: z.array(stressTestPathPointResponseSchema),
})

export const stressTestSectorImpactResponseSchema = z.object({
    sectorCode: z.string().min(1),
    sectorName: z.string().min(1),
    weight: z.number(),
    impact: z.number(),
    portfolioContribution: z.number(),
})

export const stressTestSectorImpactListResponseSchema = z.array(
    stressTestSectorImpactResponseSchema,
)

export const stressTestPortfolioPathPointResponseSchema = z.object({
    date: z.iso.date(),
    dayIndex: z.number().int().nonnegative(),
    portfolioImpact: z.number(),
})

export const stressTestPortfolioPathResponseSchema = z.object({
    points: z.array(stressTestPortfolioPathPointResponseSchema),
})

export const stressTestRiskMetricsResponseSchema = z.object({
    finalImpact: z.number(),
    maxDrawdown: z.number(),
    maxDrawdownDate: z.iso.date(),
    worstImpact: z.number(),
    worstDate: z.iso.date(),
    recoveryFromTrough: z.number(),
})

export const stressTestSectorPathPointResponseSchema = z.object({
    date: z.iso.date(),
    dayIndex: z.number().int().nonnegative(),
    impact: z.number(),
})

export const stressTestSectorPathResponseSchema = z.object({
    sectorCode: z.string().min(1),
    sectorName: z.string().min(1),
    points: z.array(stressTestSectorPathPointResponseSchema),
})

export const stressTestSectorPathListResponseSchema = z.array(
    stressTestSectorPathResponseSchema,
)

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
export type StressTestPathPointResponse = z.infer<
    typeof stressTestPathPointResponseSchema
>

export type StressTestAssetPathResponse = z.infer<
    typeof stressTestAssetPathResponseSchema
>

export type StressTestSectorImpactResponse = z.infer<
    typeof stressTestSectorImpactResponseSchema
>

export type StressTestPortfolioPathPointResponse = z.infer<
    typeof stressTestPortfolioPathPointResponseSchema
>

export type StressTestPortfolioPathResponse = z.infer<
    typeof stressTestPortfolioPathResponseSchema
>

export type StressTestRiskMetricsResponse = z.infer<
    typeof stressTestRiskMetricsResponseSchema
>

export type StressTestSectorPathPointResponse = z.infer<
    typeof stressTestSectorPathPointResponseSchema
>

export type StressTestSectorPathResponse = z.infer<
    typeof stressTestSectorPathResponseSchema
>