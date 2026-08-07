import { useCallback, useEffect, useState } from "react"

import {
  fetchOptimizationRequest,
  runOptimizationRequest,
} from "@/features/optimization/api/optimizationApi"
import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import type { OptimizationRequestResponse } from "@/features/optimization/model/optimizationSchemas"

const RUNNABLE_STATUSES = new Set(["PREPARING", "FAILED"])

export function useOptimizationRun(requestId: number) {
  const [request, setRequest] = useState<OptimizationRequestResponse | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(requestId)) {
      setIsLoading(false)
      setErrorMessage("Geçersiz optimizasyon isteği.")
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const current = await fetchOptimizationRequest(requestId)
        const next = RUNNABLE_STATUSES.has(current.status)
          ? await runOptimizationRequest(requestId)
          : current

        if (!cancelled) setRequest(next)
      } catch (error) {
        if (!cancelled) {
          setRequest(null)
          setErrorMessage(getOptimizationErrorMessage(error))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestId, attempt])

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  return { request, isLoading, errorMessage, retry }
}
