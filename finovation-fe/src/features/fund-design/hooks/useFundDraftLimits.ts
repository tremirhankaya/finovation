import { useCallback, useEffect, useState } from "react"

import { getFundDraftLimits } from "@/features/fund-design/api/fundDraftApi"
import type { FundDraftLimits } from "@/features/fund-design/model/fundDraftSchemas"

type UseFundDraftLimitsResult = {
  limits: FundDraftLimits | null
  error: string
  isLoading: boolean
  reload: () => void
}

export function useFundDraftLimits(): UseFundDraftLimitsResult {
  const [limits, setLimits] = useState<FundDraftLimits | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)

    void (async () => {
      try {
        const nextLimits = await getFundDraftLimits(controller.signal)
        if (controller.signal.aborted) return

        setLimits(nextLimits)
        setError("")
      } catch (loadError) {
        if (controller.signal.aborted) return

        setLimits(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Portföy limiti alınamadı.",
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [reloadKey])

  return { limits, error, isLoading, reload }
}
