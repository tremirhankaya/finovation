import { useEffect, useState } from "react"

import { getCompanies } from "@/service/companyService"
import type { CompanyListItem } from "@/type/company.types"

type UseCompanyOptionsResult = {
  companies: CompanyListItem[]
  error: string
}

export function useCompanyOptions(): UseCompanyOptionsResult {
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

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
      }
    })()

    return () => {
      controller.abort()
    }
  }, [])

  return { companies, error }
}
