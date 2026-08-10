import { useCallback, useEffect, useState } from "react"

import {
  loadDashboardOverview,
  loadFundPerformance,
} from "@/features/dashboard/api/dashboardService"
import type {
  DashboardOverviewData,
  DashboardSectionErrors,
  DashboardViewModel,
} from "@/features/dashboard/model/dashboard.types"
import type { FundMonitoringSnapshot } from "@/features/fund-monitoring/model/fundMonitoring.types"

const EMPTY_DATA: DashboardOverviewData = {
  funds: [],
  drafts: [],
  optimizationLogs: [],
  latestOptimizationResult: null,
  stressTests: [],
}

const EMPTY_ERRORS: DashboardSectionErrors = {
  funds: "",
  drafts: "",
  optimization: "",
  stressTests: "",
  monitoring: "",
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Fon performansı yüklenemedi."
}

export function useDashboard(): DashboardViewModel & {
  selectFund: (fundId: string) => void
  reload: () => void
} {
  const [data, setData] = useState<DashboardOverviewData>(EMPTY_DATA)
  const [selectedFundId, setSelectedFundId] = useState("")
  const [monitoringSnapshot, setMonitoringSnapshot] =
    useState<FundMonitoringSnapshot | null>(null)
  const [errors, setErrors] = useState<DashboardSectionErrors>(EMPTY_ERRORS)
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [isMonitoringLoading, setIsMonitoringLoading] = useState(false)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setIsOverviewLoading(true)

      try {
        const response = await loadDashboardOverview(controller.signal)
        if (controller.signal.aborted) return

        setData(response.data)
        setErrors((current) => ({
          ...current,
          ...response.errors,
        }))
        setSelectedFundId((current) => {
          if (response.data.funds.some((fund) => fund.id === current)) {
            return current
          }
          return response.data.funds[0]?.id ?? ""
        })
      } catch (error) {
        if (controller.signal.aborted) return

        const message =
          error instanceof Error
            ? error.message
            : "Dashboard verileri yüklenemedi."
        setData(EMPTY_DATA)
        setSelectedFundId("")
        setErrors({
          funds: message,
          drafts: message,
          optimization: message,
          stressTests: message,
          monitoring: "",
        })
      } finally {
        if (!controller.signal.aborted) setIsOverviewLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [reloadVersion])

  useEffect(() => {
    if (!selectedFundId) {
      setMonitoringSnapshot(null)
      setIsMonitoringLoading(false)
      return
    }

    const controller = new AbortController()

    async function load() {
      setIsMonitoringLoading(true)
      setErrors((current) => ({ ...current, monitoring: "" }))

      try {
        const snapshot = await loadFundPerformance(
          selectedFundId,
          controller.signal,
        )
        if (!controller.signal.aborted) setMonitoringSnapshot(snapshot)
      } catch (error) {
        if (controller.signal.aborted) return
        setMonitoringSnapshot(null)
        setErrors((current) => ({
          ...current,
          monitoring: errorMessage(error),
        }))
      } finally {
        if (!controller.signal.aborted) setIsMonitoringLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [reloadVersion, selectedFundId])

  const selectFund = useCallback((fundId: string) => {
    setSelectedFundId(fundId)
    setMonitoringSnapshot(null)
  }, [])

  const reload = useCallback(() => {
    setReloadVersion((current) => current + 1)
  }, [])

  return {
    ...data,
    selectedFundId,
    monitoringSnapshot,
    errors,
    isOverviewLoading,
    isMonitoringLoading,
    selectFund,
    reload,
  }
}
