import { type ApiErrorBody, toApiRequestError } from "@/util/apiError"
import { getAccessToken } from "@/util/authStorage"

export const SESSION_MISSING_MESSAGE = "Oturum bulunamadı. Lütfen giriş yapın."

type RequestOptions = {
  errorMessage: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  requiresAuth?: boolean
  signal?: AbortSignal
}

function buildHeaders(options: RequestOptions): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  if (options.requiresAuth !== false) {
    const accessToken = getAccessToken()

    if (!accessToken) {
      throw new Error(SESSION_MISSING_MESSAGE)
    }

    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (!response.ok) {
    throw toApiRequestError(
      (await response.json().catch(() => ({}))) as ApiErrorBody,
      response.status,
      options.errorMessage,
    )
  }

  return response
}

export async function apiFetch<T>(
  url: string,
  options: RequestOptions,
): Promise<T> {
  const response = await send(url, options)
  return (await response.json()) as T
}

export async function apiSend(
  url: string,
  options: RequestOptions,
): Promise<void> {
  await send(url, options)
}
