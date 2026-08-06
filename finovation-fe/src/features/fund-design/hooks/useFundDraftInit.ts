import { useCallback, useEffect, useState } from "react"

import { getFundDraftInit } from "@/features/fund-design/api/fundDraftApi"
import type { FundDraftInit } from "@/features/fund-design/model/fundDraftSchemas"

type UseFundDraftInitResult = {
  init: FundDraftInit | null
  error: string
  isLoading: boolean
  reload: () => void
}

export function useFundDraftInit(): UseFundDraftInitResult {
  const [init, setInit] = useState<FundDraftInit | null>(null)
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
        const nextInit = await getFundDraftInit(controller.signal)
        if (controller.signal.aborted) return

        setInit(nextInit)
        setError("")
      } catch (loadError) {
        if (controller.signal.aborted) return

        setInit(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Fon taslağı başlangıç verisi alınamadı.",
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

  return { init, error, isLoading, reload }
}
