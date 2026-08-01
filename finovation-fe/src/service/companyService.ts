import { getCompaniesUrl } from "@/config/api"
import { apiFetch } from "@/service/httpClient"
import type { CompanyListItem } from "@/type/company.types"

export async function getCompanies(
  signal?: AbortSignal,
): Promise<CompanyListItem[]> {
  const companies = await apiFetch<CompanyListItem[]>(getCompaniesUrl(), {
    errorMessage: "Şirket listesi alınamadı",
    signal,
  })

  if (!Array.isArray(companies)) {
    throw new Error("Şirket listesi beklenmeyen formatta geldi.")
  }

  return companies
}
