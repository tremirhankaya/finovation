import { ApiRequestError } from "@/shared/api/apiError"

const FALLBACK_MESSAGE =
  "Fon izleme verileri yüklenemedi. Lütfen daha sonra tekrar deneyin."

export function getFundMonitoringErrorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : FALLBACK_MESSAGE
}
