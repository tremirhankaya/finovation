import { getRefreshUrl } from "@/shared/api/apiConfig"
import { type ApiErrorBody, toApiRequestError } from "@/shared/api/apiError"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from "@/shared/auth/authStorage"
import { emitSessionExpired } from "@/shared/auth/sessionEvents"

export const SESSION_MISSING_MESSAGE = "Oturum bulunamadı. Lütfen giriş yapın."

type RequestOptions = {
  errorMessage: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  requiresAuth?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

type RefreshResponseBody = {
  accessToken?: string
  refreshToken?: string
}

type RefreshResult = "refreshed" | "failed" | "stale"
type RefreshOperation = {
  sessionVersion: number
  promise: Promise<RefreshResult>
}

const REQUEST_TIMEOUT_MS = 60_000

let sessionVersion = 0
let refreshOperation: RefreshOperation | null = null

export function invalidateAuthSession(): void {
  sessionVersion += 1
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(init.signal?.reason)
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  )

  if (init.signal?.aborted) {
    onCallerAbort()
  } else {
    init.signal?.addEventListener("abort", onCallerAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new Error("Sunucu yanıt vermedi. Lütfen tekrar deneyin.")
    }

    if (!init.signal?.aborted) {
      throw new Error(
        "Sunucuya bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
    init.signal?.removeEventListener("abort", onCallerAbort)
  }
}

function expireSession(): void {
  invalidateAuthSession()
  clearTokens()
  emitSessionExpired()
}

async function refreshAccessToken(
  operationVersion: number,
): Promise<RefreshResult> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    return "failed"
  }

  const response = await fetchWithTimeout(getRefreshUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    return "failed"
  }

  const body = (await response.json().catch(() => ({}))) as RefreshResponseBody

  if (!body.accessToken || !body.refreshToken) {
    return "failed"
  }

  if (operationVersion !== sessionVersion) {
    return "stale"
  }

  saveAccessToken(body.accessToken)
  saveRefreshToken(body.refreshToken)
  return "refreshed"
}

function refreshAccessTokenOnce(): Promise<RefreshResult> {
  const operationVersion = sessionVersion

  if (
    !refreshOperation ||
    refreshOperation.sessionVersion !== operationVersion
  ) {
    const promise = refreshAccessToken(operationVersion).finally(() => {
      if (refreshOperation?.promise === promise) {
        refreshOperation = null
      }
    })
    refreshOperation = { sessionVersion: operationVersion, promise }
  }

  return refreshOperation.promise
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

async function rawSend(
  url: string,
  options: RequestOptions,
): Promise<Response> {
  return fetchWithTimeout(url, {
    method: options.method ?? "GET",
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  }, options.timeoutMs)
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  let response = await rawSend(url, options)

  if (response.status === 401 && options.requiresAuth !== false) {
    const refreshResult = await refreshAccessTokenOnce()

    if (refreshResult === "refreshed") {
      response = await rawSend(url, options)
      if (response.status === 401) {
        expireSession()
      }
    } else if (refreshResult === "failed") {
      expireSession()
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
  parse?: (body: unknown) => T,
): Promise<T> {
  const response = await send(url, options)
  const body: unknown = await response.json()

  if (!parse) return body as T

  try {
    return parse(body)
  } catch {
    throw new Error(
      `${options.errorMessage}. Sunucudan beklenmeyen bir yanıt alındı.`,
    )
  }
}

export async function apiSend(
  url: string,
  options: RequestOptions,
): Promise<void> {
  await send(url, options)
}
