import { useCallback, useEffect, useState } from "react"

import {
  fetchFundMonitoring,
  fetchFunds,
} from "@/features/fund-monitoring/api/fundMonitoringService"
import { getFundMonitoringErrorMessage } from "@/features/fund-monitoring/lib/fundMonitoringError"
import type {
  FundMonitoringSnapshot,
  FundOption,
} from "@/features/fund-monitoring/model/fundMonitoring.types"

export function useFundMonitoring() {
  const [funds, setFunds] = useState<FundOption[]>([])
  const [selectedFundId, setSelectedFundId] = useState("")
  const [snapshot, setSnapshot] = useState<FundMonitoringSnapshot | null>(null)
  const [isLoadingFunds, setIsLoadingFunds] = useState(true)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadFunds() {
      setIsLoadingFunds(true)
      setErrorMessage("")

      try {
        const response = await fetchFunds(controller.signal)
        setFunds(response)
        setSelectedFundId((current) => {
          if (response.some((fund) => fund.id === current)) return current
          return response[0]?.id ?? ""
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          setFunds([])
          setSelectedFundId("")
          setSnapshot(null)
          setErrorMessage(getFundMonitoringErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingFunds(false)
      }
    }

    void loadFunds()
    return () => controller.abort()
  }, [reloadVersion])

  useEffect(() => {
    if (!selectedFundId) {
      setSnapshot(null)
      return
    }

    const controller = new AbortController()

    async function loadSnapshot() {
      setIsLoadingSnapshot(true)
      setErrorMessage("")

      try {
        setSnapshot(
          await fetchFundMonitoring(selectedFundId, controller.signal),
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setSnapshot(null)
          setErrorMessage(getFundMonitoringErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingSnapshot(false)
      }
    }

    void loadSnapshot()
    return () => controller.abort()
  }, [reloadVersion, selectedFundId])

  const reload = useCallback(() => {
    setReloadVersion((current) => current + 1)
  }, [])

  const selectFund = useCallback((fundId: string) => {
    setSelectedFundId(fundId)
    setSnapshot(null)
  }, [])

  return {
    funds,
    selectedFundId,
    snapshot,
    isLoading: isLoadingFunds || isLoadingSnapshot,
    errorMessage,
    selectFund,
    reload,
  }
}
