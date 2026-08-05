import { getFundDraftLimitsUrl, getFundDraftsUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import {
  type CreatedFundDraft,
  type FundDraftLimits,
  createdFundDraftSchema,
  fundDraftLimitsSchema,
} from "@/features/fund-design/model/fundDraftSchemas"

export async function getFundDraftLimits(
  signal?: AbortSignal,
): Promise<FundDraftLimits> {
  return apiFetch(
    getFundDraftLimitsUrl(),
    {
      errorMessage: "Portföy limiti alınamadı",
      signal,
    },
    fundDraftLimitsSchema.parse,
  )
}

export async function createFundDraft(
  initialPortfolioSize: number,
): Promise<CreatedFundDraft> {
  return apiFetch(
    getFundDraftsUrl(),
    {
      method: "POST",
      body: { initialPortfolioSize },
      errorMessage: "Fon taslağı oluşturulamadı",
    },
    createdFundDraftSchema.parse,
  )
}
