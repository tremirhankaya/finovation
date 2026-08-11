import {
  getFundDraftAnalysisUrl,
  getFundDraftCompletionUrl,
  getFundDraftInitUrl,
  getFundDraftModelUniverseUrl,
  getFundDraftPortfolioRulesUrl,
  getFundDraftSelectedProposalUrl,
  getFundDraftWorkingPortfolioUrl,
  getFundDraftUrl,
  getFundDraftsUrl,
  getFundEstimatesUrl,
} from "@/shared/api/apiConfig"
import { apiFetch, apiSend } from "@/shared/api/httpClient"
import {
  type ArchivedFundDraft,
  type CreatedFundDraft,
  type FundDesignInitPage,
  type FundDraft,
  type FundDraftInit,
  type FundDraftPage,
  type FundDraftPortfolioRules,
  type ModelUniverseAsset,
  type FundDraftSummary,
  archivedFundDraftSchema,
  createdFundDraftSchema,
  fundDraftInitSchema,
  fundDraftPageSchema,
  fundDraftPortfolioRulesSchema,
  fundDraftSchema,
  modelUniverseAssetSchema,
  workingPortfolioResponseSchema,
  type FundPositionResponse,
  type WorkingPortfolioResponse,
} from "@/features/fund-design/model/fundDraftSchemas"
import type { ManagementApproachCode } from "@/features/fund-design/model/managementApproach"
import { z } from "zod"

export type { ModelUniverseAsset, FundDraftSummary }

export type CreateFundDraftInput = {
  name: string
  initialPortfolioSize: number
  unitPrice: number
  designMode?: "AI_ASSISTED" | "MANUAL"
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

export type FundDraftSortField = "NAME" | "INITIAL_PORTFOLIO_SIZE" | "CREATED_AT" | "UPDATED_AT"

export type SortDirection = "ASC" | "DESC"

export type SearchFundDraftsInput = {
  page?: number
  size?: number
  q?: string
  status?: "IN_PROGRESS" | "COMPLETED"
  managementApproach?: ManagementApproachCode
  designMode?: "AI_ASSISTED" | "MANUAL"
  sortBy?: FundDraftSortField
  direction?: SortDirection
}

export async function searchFundDrafts(
  input: SearchFundDraftsInput = {},
  signal?: AbortSignal,
): Promise<FundDraftPage> {
  const params = new URLSearchParams()
  params.set("page", String(input.page ?? 0))
  params.set("size", String(input.size ?? 10))
  if (input.q) params.set("q", input.q)
  if (input.status) params.set("status", input.status)
  if (input.managementApproach) {
    params.set("managementApproach", input.managementApproach)
  }
  if (input.designMode) {
    params.set("designMode", input.designMode)
  }
  if (input.sortBy) params.set("sortBy", input.sortBy)
  if (input.direction) params.set("direction", input.direction)

  return apiFetch(
    `${getFundDraftsUrl()}?${params.toString()}`,
    {
      errorMessage: "Fon listesi alınamadı",
      signal,
    },
    fundDraftPageSchema.parse,
  )
}

export async function listArchivedFundDrafts(
  signal?: AbortSignal,
): Promise<ArchivedFundDraft[]> {
  return apiFetch(
    `${getFundDraftsUrl()}/archived`,
    { errorMessage: "Kaldırılan fonlar alınamadı", signal },
    (data) => z.array(archivedFundDraftSchema).parse(data),
  )
}

export async function updateFundDraftPinStatus(
  draftId: string,
  pinned: boolean,
): Promise<void> {
  return apiSend(`${getFundDraftsUrl()}/${draftId}/pin`, {
    method: "PUT",
    body: { pinned },
    errorMessage: "Sabitleme durumu güncellenemedi",
  })
}

export async function cloneDeletedFundDraft(
  draftId: string,
  payload: {
    name: string
    initialPortfolioSize: number
    unitPrice: number
  },
): Promise<FundDraft> {
  return apiFetch(
    `${getFundDraftsUrl()}/${draftId}/clone-deleted`,
    {
      method: "POST",
      body: payload,
      errorMessage: "Taslak kopyalanamadı",
    },
    fundDraftSchema.parse,
  )
}

export async function archiveFundDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiSend(getFundDraftUrl(draftId), {
    method: "DELETE",
    errorMessage: "Arşivlenemedi",
    signal,
  })
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
export type FundModelAnalysisResponse = z.infer<typeof fundModelAnalysisResponseSchema>
export type FundDraftAnalysisState = z.infer<typeof fundDraftAnalysisStateSchema>


const FUND_ANALYSIS_TIMEOUT_MS = 180_000

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
      timeoutMs: FUND_ANALYSIS_TIMEOUT_MS,
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

export async function completeFundDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<FundDraft> {
  return apiFetch(
    getFundDraftCompletionUrl(draftId),
    {
      method: "POST",
      errorMessage: "Taslak tamamlanamadı",
      signal,
    },
    fundDraftSchema.parse,
  )
}

export type FundEstimates = {
  beta: number | null
  volatilityPct: number | null
  sharpeRatio: number | null
  maxDrawdownPct: number | null
}

export async function getFundEstimates(
  draftId: string,
): Promise<FundEstimates> {
  return apiFetch(getFundEstimatesUrl(draftId), {
    method: "GET",
    errorMessage: "Fon tahmin özellikleri alınamadı",
  })
}

export type { FundPositionResponse, WorkingPortfolioResponse }

export async function getWorkingPortfolio(
  draftId: string,
  signal?: AbortSignal,
): Promise<WorkingPortfolioResponse> {
  return apiFetch(
    getFundDraftWorkingPortfolioUrl(draftId),
    {
      errorMessage: "Çalışma portföyü alınamadı",
      signal,
    },
    workingPortfolioResponseSchema.parse,
  )
}

export async function updateWorkingPortfolio(
  draftId: string,
  assets: Array<{ asset_code: string; weight: number; ai_note?: string | null }>,
  signal?: AbortSignal,
): Promise<WorkingPortfolioResponse> {
  return apiFetch(
    getFundDraftWorkingPortfolioUrl(draftId),
    {
      method: "PUT",
      body: { assets },
      errorMessage: "Çalışma portföyü güncellenemedi",
      signal,
    },
    workingPortfolioResponseSchema.parse,
  )
}
