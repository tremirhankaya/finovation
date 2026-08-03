import { getCompaniesUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"
import type { CompanyListItem } from "@/features/users/model/company.types"
import { companyListSchema } from "@/features/users/model/userSchemas"

export async function getCompanies(
  signal?: AbortSignal,
): Promise<CompanyListItem[]> {
  return apiFetch<CompanyListItem[]>(
    getCompaniesUrl(),
    { errorMessage: "Şirket listesi alınamadı", signal },
    companyListSchema.parse,
  )
}
