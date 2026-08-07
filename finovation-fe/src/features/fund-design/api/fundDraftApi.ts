import {
  getFundDraftAnalysisUrl,
  getFundDraftInitUrl,
  getFundDraftModelUniverseUrl,
  getFundDraftPortfolioRulesUrl,
  getFundDraftSelectedProposalUrl,
  getFundDraftUrl,
  getFundDraftsUrl,
} from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import {
  type CreatedFundDraft,
  type FundDesignInitPage,
  type FundDraft,
  type FundDraftInit,
  type FundDraftPortfolioRules,
  type ModelUniverseAsset,
  createdFundDraftSchema,
  fundDraftInitSchema,
  fundDraftPortfolioRulesSchema,
  fundDraftSchema,
  modelUniverseAssetSchema,
} from "@/features/fund-design/model/fundDraftSchemas"
import type { ManagementApproachCode } from "@/features/fund-design/model/managementApproach"
import { z } from "zod"

export type { ModelUniverseAsset }

export type CreateFundDraftInput = {
  name: string
  initialPortfolioSize: number
  unitPrice: number
}

export type UpdateFundDraftPortfolioRulesInput = {
  managementApproach: ManagementApproachCode
  tppMinPct: number
  tppMaxPct: number
  preferredTppPct: number
  minStockCount: number
  maxStockCount: number
  excludedAssetCodes: string[]
  forcedAssetCodes: string[]
}

export type GetFundDraftInitOptions = {
  page: FundDesignInitPage
  draftId?: string
  signal?: AbortSignal
}

export async function getFundDraftInit(
  options: GetFundDraftInitOptions,
): Promise<FundDraftInit> {
  return apiFetch(
    getFundDraftInitUrl(options.page, options.draftId),
    {
      errorMessage: "Fon taslağı başlangıç verisi alınamadı",
      signal: options.signal,
    },
    fundDraftInitSchema.parse,
  )
}

export async function getFundDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<FundDraft> {
  return apiFetch(
    getFundDraftUrl(draftId),
    {
      errorMessage: "Fon taslağı alınamadı",
      signal,
    },
    fundDraftSchema.parse,
  )
}

export async function createFundDraft(
  input: CreateFundDraftInput,
): Promise<CreatedFundDraft> {
  return apiFetch(
    getFundDraftsUrl(),
    {
      method: "POST",
      body: input,
      errorMessage: "Fon taslağı oluşturulamadı",
    },
    createdFundDraftSchema.parse,
  )
}

export async function updateFundDraftPortfolioRules(
  draftId: string,
  input: UpdateFundDraftPortfolioRulesInput,
  signal?: AbortSignal,
): Promise<FundDraftPortfolioRules> {
  return apiFetch(
    getFundDraftPortfolioRulesUrl(draftId),
    {
      method: "PUT",
      body: input,
      errorMessage: "Portföy kuralları kaydedilemedi",
      signal,
    },
    fundDraftPortfolioRulesSchema.parse,
  )
}

export async function getModelUniverse(
  signal?: AbortSignal,
): Promise<ModelUniverseAsset[]> {
  return apiFetch(
    getFundDraftModelUniverseUrl(),
    {
      errorMessage: "Hisse evreni alınamadı",
      signal,
    },
    z.array(modelUniverseAssetSchema).parse,
  )
}

const fundModelAssetSchema = z.object({
  asset_code: z.string(),
  weight: z.coerce.number(),
  ai_note: z.string().nullable().optional(),
})

const fundModelProposalSchema = z.object({
  rank: z.number(),
  label: z.string(),
  assets: z.array(fundModelAssetSchema),
})

export const fundModelAnalysisResponseSchema = z.object({
  proposals: z.array(fundModelProposalSchema),
})

export const fundDraftAnalysisStateSchema = z.object({
  rulesFingerprint: z.string(),
  proposals: z.array(fundModelProposalSchema),
  selectedRank: z.number().int().nullable(),
})

export type FundModelAsset = z.infer<typeof fundModelAssetSchema>
export type FundModelProposal = z.infer<typeof fundModelProposalSchema>
export type FundModelAnalysisResponse = z.infer<
  typeof fundModelAnalysisResponseSchema
>
export type FundDraftAnalysisState = z.infer<typeof fundDraftAnalysisStateSchema>

export async function getFundDraftAnalysisState(
  draftId: string,
  signal?: AbortSignal,
): Promise<FundDraftAnalysisState> {
  return apiFetch(
    getFundDraftAnalysisUrl(draftId),
    {
      errorMessage: "Analiz sonucu alınamadı",
      signal,
    },
    fundDraftAnalysisStateSchema.parse,
  )
}

export async function runFundDraftAnalysis(
  draftId: string,
  signal?: AbortSignal,
): Promise<FundModelAnalysisResponse> {
  return apiFetch(
    getFundDraftAnalysisUrl(draftId),
    {
      method: "POST",
      errorMessage: "AI analizi başlatılamadı",
      signal,
    },
    fundModelAnalysisResponseSchema.parse,
  )
}

export async function selectFundDraftProposal(
  draftId: string,
  rank: number,
  signal?: AbortSignal,
): Promise<FundDraftAnalysisState> {
  return apiFetch(
    getFundDraftSelectedProposalUrl(draftId),
    {
      method: "PUT",
      body: { rank },
      errorMessage: "Öneri seçilemedi",
      signal,
    },
    fundDraftAnalysisStateSchema.parse,
  )
}
