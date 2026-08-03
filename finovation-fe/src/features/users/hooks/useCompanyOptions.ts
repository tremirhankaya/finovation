import { useCallback, useEffect, useState } from "react"

import { getCompanies } from "@/features/users/api/companyService"
import type { CompanyListItem } from "@/features/users/model/company.types"

type UseCompanyOptionsResult = {
  companies: CompanyListItem[]
  error: string
  isLoading: boolean
  reload: () => void
}

export function useCompanyOptions(): UseCompanyOptionsResult {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)

    void (async () => {
      try {
        const companyList = await getCompanies(controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setCompanies(companyList)
        setError("")
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setCompanies([])
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Şirket listesi alınamadı.",
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

  return { companies, error, isLoading, reload }
}
