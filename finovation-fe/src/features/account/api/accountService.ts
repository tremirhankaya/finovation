import { getPasswordChangeUrl } from "@/shared/api/apiConfig"
import { apiSend } from "@/shared/api/httpClient"
import type { PasswordChangePayload } from "@/features/account/model/passwordChange"

export async function changePassword(
  payload: PasswordChangePayload,
): Promise<void> {
  await apiSend(getPasswordChangeUrl(), {
    method: "PUT",
    body: payload,
    errorMessage: "Parola değiştirilemedi",
  })
}
