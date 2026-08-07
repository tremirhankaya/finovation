import { getCompaniesUrl } from "@/shared/api/apiConfig"
import { apiFetch, apiSend } from "@/shared/api/httpClient"
import type {
  CompanyListItem,
  CreateCompanyPayload,
} from "@/features/users/model/company.types"
import {
  companyListItemSchema,
  companyListSchema,
} from "@/features/users/model/userSchemas"

export async function getCompanies(
  signal?: AbortSignal,
): Promise<CompanyListItem[]> {
  return apiFetch<CompanyListItem[]>(
    getCompaniesUrl(),
    { errorMessage: "Şirket listesi alınamadı", signal },
    companyListSchema.parse,
  )
}

export async function createCompany(
  payload: CreateCompanyPayload,
): Promise<CompanyListItem> {
  return apiFetch<CompanyListItem>(
    getCompaniesUrl(),
    {
      method: "POST",
      body: payload,
      errorMessage: "Şirket oluşturulamadı",
    },
    companyListItemSchema.parse,
  )
}

export async function deleteCompany(companyId: number): Promise<void> {
  await apiSend(getCompaniesUrl(companyId), {
    method: "DELETE",
    errorMessage: "Şirket silinemedi",
  })
}
