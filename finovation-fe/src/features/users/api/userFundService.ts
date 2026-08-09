import { userFundListSchema } from "@/features/users/model/userFundSchemas"
import type { UserFund } from "@/features/users/model/userFund.types"
import { getUserFundsUrl } from "@/shared/api/apiConfig"
import { apiFetch } from "@/shared/api/httpClient"

export async function getUserFunds(
  userId: number,
  signal?: AbortSignal,
): Promise<UserFund[]> {
  return apiFetch<UserFund[]>(
    getUserFundsUrl(userId),
    {
      errorMessage: "Kullanıcının fonları alınamadı",
      signal,
    },
    userFundListSchema.parse,
  )
}
