import { getRefreshUrl } from "@/config/api"
import { type ApiErrorBody, toApiRequestError } from "@/util/apiError"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "@/util/authStorage"
import { emitSessionExpired } from "@/util/sessionEvents"

export const SESSION_MISSING_MESSAGE = "Oturum bulunamadı. Lütfen giriş yapın."

type RequestOptions = {
  errorMessage: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  requiresAuth?: boolean
  signal?: AbortSignal
}

type RefreshResponseBody = {
  accessToken?: string
  refreshToken?: string
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    return false
  }

  const response = await fetch(getRefreshUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    return false
  }

  const body = (await response.json().catch(() => ({}))) as RefreshResponseBody

  if (!body.accessToken || !body.refreshToken) {
    return false
  }

  saveAccessToken(body.accessToken)
  saveRefreshToken(body.refreshToken)
  return true
}

function refreshAccessTokenOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
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

async function rawSend(url: string, options: RequestOptions): Promise<Response> {
  return fetch(url, {
    method: options.method ?? "GET",
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  let response = await rawSend(url, options)

  if (response.status === 401 && options.requiresAuth !== false) {
    const refreshed = await refreshAccessTokenOnce()

    if (refreshed) {
      response = await rawSend(url, options)
    } else {
      clearTokens()
      emitSessionExpired()
    }
  }

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
