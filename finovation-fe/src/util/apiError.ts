export type ApiErrorBody = {
  message?: string
  error?: string
  detail?: string
  code?: string
  status?: number
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = code
  }

  get isPermissionError() {
    return this.status === 403 || this.code === "AUTH_004"
  }
}

export function toApiRequestError(
  body: ApiErrorBody,
  status: number,
  fallback: string,
): ApiRequestError {
  const message =
    body.message || body.detail || body.error || `${fallback} (HTTP ${status}).`

  return new ApiRequestError(message, status, body.code)
}

export function isPermissionError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.isPermissionError
}
