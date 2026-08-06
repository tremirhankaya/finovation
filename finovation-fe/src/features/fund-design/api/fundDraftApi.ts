import { getFundDraftInitUrl, getFundDraftsUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import {
  type CreatedFundDraft,
  type FundDraftInit,
  createdFundDraftSchema,
  fundDraftInitSchema,
} from "@/features/fund-design/model/fundDraftSchemas"

export type CreateFundDraftInput = {
  name: string
  initialPortfolioSize: number
  unitPrice: number
}

export async function getFundDraftInit(
  signal?: AbortSignal,
): Promise<FundDraftInit> {
  return apiFetch(
    getFundDraftInitUrl(),
    {
      errorMessage: "Fon taslağı başlangıç verisi alınamadı",
      signal,
    },
    fundDraftInitSchema.parse,
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
