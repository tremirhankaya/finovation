import { useCallback, useEffect, useRef, useState } from "react"

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
  // Effects can run twice for the same requestId/attempt (React StrictMode in
  // dev, or a fast double-mount). Both invocations must observe the *same*
  // run() outcome instead of each firing its own POST — otherwise the second
  // POST races the first and gets rejected with "cannot transition from
  // RUNNING", or an invocation that skips its own POST ends up displaying a
  // stale pre-run snapshot forever because the real result landed on the
  // other (cancelled) invocation.
  const inFlightRunRef = useRef<{
    key: string
    promise: Promise<OptimizationRequestResponse>
  } | null>(null)

  useEffect(() => {
    if (!Number.isFinite(requestId)) {
      setIsLoading(false)
      setErrorMessage("Geçersiz optimizasyon isteği.")
      return
    }

    let cancelled = false
    const dispatchKey = `${requestId}:${attempt}`

    async function load() {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const current = await fetchOptimizationRequest(requestId)
        let next = current
        if (RUNNABLE_STATUSES.has(current.status)) {
          if (inFlightRunRef.current?.key !== dispatchKey) {
            inFlightRunRef.current = {
              key: dispatchKey,
              promise: runOptimizationRequest(requestId),
            }
          }
          next = await inFlightRunRef.current.promise
        }

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
