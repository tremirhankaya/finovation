import { ApiRequestError } from "@/shared/api/apiError"

const FALLBACK_MESSAGE =
  "Optimizasyon çalıştırılamadı. Lütfen daha sonra tekrar deneyin."

export function getOptimizationErrorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : FALLBACK_MESSAGE
}
