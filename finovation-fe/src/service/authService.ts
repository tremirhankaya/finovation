import { getLoginUrl } from "@/config/api"
import type { LoginCredentials } from "@/schema/authSchema"
import type { LoginResponse } from "@/type/auth.types"

type ApiErrorResponse = {
  message?: string
  error?: string
  detail?: string
}

function getLoginErrorMessage(body: ApiErrorResponse, status: number) {
  return (
    body.message ||
    body.detail ||
    body.error ||
    `Giriş başarısız oldu (HTTP ${status}).`
  )
}

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await fetch(getLoginUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    const errorResponse = (await response
      .json()
      .catch(() => ({}))) as ApiErrorResponse

    throw new Error(getLoginErrorMessage(errorResponse, response.status))
  }

  return (await response.json()) as LoginResponse
}
