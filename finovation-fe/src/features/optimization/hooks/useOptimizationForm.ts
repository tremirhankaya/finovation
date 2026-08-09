import { useCallback, useEffect, useMemo, useState } from "react"

import {
  createOptimizationRequest,
  fetchInvestmentUniverse,
  fetchOptimizableFunds,
} from "@/features/optimization/api/optimizationApi"
import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import {
  buildComplianceRows,
  isComplianceReady,
} from "@/features/optimization/lib/optimizationCompliance"
import { toOptimizableFund } from "@/features/optimization/lib/optimizableFund"
import { getSuggestedConstraints } from "@/features/optimization/lib/riskProfileDefaults"
import type { WizardStep } from "@/features/optimization/components/OptimizationWizardSteps"
import type {
  AssetSelectionMap,
  AssetSelectionType,
  OptimizableFund,
  UniverseAsset,
} from "@/features/optimization/model/optimizationForm.types"
import type {
  AssetPreferenceRequest,
  RiskProfile,
} from "@/features/optimization/model/optimizationSchemas"
import { fetchFundMonitoring } from "@/features/fund-monitoring/api/fundMonitoringService"
import { getFundMonitoringErrorMessage } from "@/features/fund-monitoring/lib/fundMonitoringError"
import type { FundMonitoringSnapshot } from "@/features/fund-monitoring/model/fundMonitoring.types"

const DEFAULT_RISK_PROFILE: RiskProfile = "BALANCED"
const DEFAULT_CONSTRAINTS = getSuggestedConstraints(DEFAULT_RISK_PROFILE)
const DEFAULT_MAX_ADDITIONS = 3
const MAX_ADDITIONS_FLOOR = 0
const MAX_ADDITIONS_CEILING = 30

export function useOptimizationForm() {
  const [step, setStep] = useState<WizardStep>(1)
  const [funds, setFunds] = useState<OptimizableFund[]>([])
  const [selectedFundId, setSelectedFundId] = useState("")
  const [snapshot, setSnapshot] = useState<FundMonitoringSnapshot | null>(null)
  const [isLoadingFunds, setIsLoadingFunds] = useState(true)
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false)
  const [loadErrorMessage, setLoadErrorMessage] = useState("")
  const [universeAssets, setUniverseAssets] = useState<UniverseAsset[]>([])
  const [isLoadingUniverse, setIsLoadingUniverse] = useState(true)

  const [riskProfile, setRiskProfileState] =
    useState<RiskProfile>(DEFAULT_RISK_PROFILE)
  const [selection, setSelection] = useState<AssetSelectionMap>({})
  const [tppMinWeight, setTppMinWeight] = useState(
    DEFAULT_CONSTRAINTS.tppMinWeight,
  )
  const [tppMaxWeight, setTppMaxWeight] = useState(
    DEFAULT_CONSTRAINTS.tppMaxWeight,
  )
  const [stockCountMin, setStockCountMin] = useState(
    DEFAULT_CONSTRAINTS.stockCountMin,
  )
  const [stockCountMax, setStockCountMax] = useState(
    DEFAULT_CONSTRAINTS.stockCountMax,
  )
  const [maxAdditions, setMaxAdditions] = useState(DEFAULT_MAX_ADDITIONS)

  const setRiskProfile = useCallback((nextRiskProfile: RiskProfile) => {
    setRiskProfileState(nextRiskProfile)
    const suggested = getSuggestedConstraints(nextRiskProfile)
    setTppMinWeight(suggested.tppMinWeight)
    setTppMaxWeight(suggested.tppMaxWeight)
    setStockCountMin(suggested.stockCountMin)
    setStockCountMax(suggested.stockCountMax)
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function loadFunds() {
      setIsLoadingFunds(true)
      setLoadErrorMessage("")

      try {
        const response = await fetchOptimizableFunds(controller.signal)
        const mapped = response.map(toOptimizableFund)
        setFunds(mapped)
        setSelectedFundId((current) => current || mapped[0]?.id || "")
      } catch (error) {
        if (!controller.signal.aborted) {
          setFunds([])
          setLoadErrorMessage(getOptimizationErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingFunds(false)
      }
    }

    void loadFunds()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadUniverse() {
      setIsLoadingUniverse(true)

      try {
        const response = await fetchInvestmentUniverse(controller.signal)
        setUniverseAssets(
          response.map((asset) => ({
            assetCode: asset.assetCode,
            symbol: asset.assetCode,
            name: asset.name,
            sectorName: asset.sectorName,
          })),
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setUniverseAssets([])
          setLoadErrorMessage(getOptimizationErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingUniverse(false)
      }
    }

    void loadUniverse()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedFundId) {
      setSnapshot(null)
      return
    }

    const controller = new AbortController()

    async function loadSnapshot() {
      setIsLoadingSnapshot(true)
      setLoadErrorMessage("")
      setSelection({})

      try {
        setSnapshot(
          await fetchFundMonitoring(selectedFundId, controller.signal),
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          setSnapshot(null)
          setLoadErrorMessage(getFundMonitoringErrorMessage(error))
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingSnapshot(false)
      }
    }

    void loadSnapshot()
    return () => controller.abort()
  }, [selectedFundId])

  const toggleSelection = useCallback(
    (assetCode: string, type: AssetSelectionType) => {
      setSelection((current) => {
        const next = { ...current }
        if (next[assetCode] === type) {
          delete next[assetCode]
        } else {
          next[assetCode] = type
        }
        return next
      })
    },
    [],
  )

  const keptAssets = useMemo(
    () =>
      (snapshot?.positions ?? []).filter(
        (position) => selection[position.assetId] === "KEEP",
      ),
    [snapshot, selection],
  )

  const excludedAssetCodes = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, type]) => type === "EXCLUDE")
        .map(([assetCode]) => assetCode),
    [selection],
  )

  const forceAddedAssetCodes = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, type]) => type === "FORCE_ADD")
        .map(([assetCode]) => assetCode),
    [selection],
  )

  const keptWeightSum = useMemo(
    () => keptAssets.reduce((sum, asset) => sum + asset.weightPercentage, 0),
    [keptAssets],
  )

  const selectedFundSummary = useMemo(
    () => funds.find((fund) => fund.id === selectedFundId) ?? null,
    [funds, selectedFundId],
  )

  const maxKeptSingleStockWeightPct = useMemo(
    () =>
      keptAssets.reduce(
        (max, asset) => Math.max(max, asset.weightPercentage),
        0,
      ),
    [keptAssets],
  )

  const maxKeptSectorWeightPct = useMemo(() => {
    const weightBySector = new Map<string, number>()
    for (const asset of keptAssets) {
      const sectorName = asset.sectorName ?? "Bilinmeyen sektör"
      weightBySector.set(
        sectorName,
        (weightBySector.get(sectorName) ?? 0) + asset.weightPercentage,
      )
    }
    return Math.max(0, ...weightBySector.values())
  }, [keptAssets])

  const complianceRows = useMemo(
    () =>
      buildComplianceRows({
        tppMinWeight,
        tppMaxWeight,
        stockCountMin,
        stockCountMax,
        keptAssetCount: keptAssets.length,
        keptWeightSum,
        forceAddedAssetCount: forceAddedAssetCodes.length,
        excludedAssetCount: excludedAssetCodes.length,
        currentEquityWeightPct: selectedFundSummary?.equityWeightPercent ?? null,
        maxKeptSingleStockWeightPct,
        maxKeptSectorWeightPct,
      }),
    [
      tppMinWeight,
      tppMaxWeight,
      stockCountMin,
      stockCountMax,
      keptAssets.length,
      keptWeightSum,
      forceAddedAssetCodes.length,
      excludedAssetCodes.length,
      selectedFundSummary,
      maxKeptSingleStockWeightPct,
      maxKeptSectorWeightPct,
    ],
  )

  const canSubmit =
    isComplianceReady(complianceRows) && !isSubmitting && !!selectedFundId

  const submit = useCallback(
    async (onSubmitted: (createdRequestId: number) => void) => {
      if (!canSubmit || !selectedFundId) return

      setIsSubmitting(true)
      setSubmitErrorMessage("")

      const assetPreferences: AssetPreferenceRequest[] = [
        ...keptAssets.map((asset) => ({
          assetCode: asset.symbol,
          preferenceType: "KEEP" as const,
          currentWeight: asset.weightPercentage,
        })),
        ...excludedAssetCodes.map((assetCode) => ({
          assetCode,
          preferenceType: "EXCLUDE" as const,
          currentWeight: null,
        })),
        ...forceAddedAssetCodes.map((assetCode) => ({
          assetCode,
          preferenceType: "FORCE_ADD" as const,
          currentWeight: null,
        })),
      ]

      try {
        const created = await createOptimizationRequest({
          fundId: selectedFundId,
          riskProfile,
          assetPreferences,
          tppMinWeight,
          tppMaxWeight,
          stockCountMin,
          stockCountMax,
          maxAdditions,
        })
        onSubmitted(created.id)
      } catch (error) {
        setSubmitErrorMessage(getOptimizationErrorMessage(error))
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      canSubmit,
      selectedFundId,
      keptAssets,
      excludedAssetCodes,
      forceAddedAssetCodes,
      riskProfile,
      tppMinWeight,
      tppMaxWeight,
      stockCountMin,
      stockCountMax,
      maxAdditions,
    ],
  )

  return {
    step,
    goToPreferences: () => setStep(2),
    goToFundSelection: () => setStep(1),
    funds,
    selectedFundId,
    selectedFundSummary,
    selectFund: setSelectedFundId,
    snapshot,
    isLoadingFunds,
    isLoading: isLoadingFunds || isLoadingSnapshot || isLoadingUniverse,
    loadErrorMessage,
    riskProfile,
    setRiskProfile,
    selection,
    toggleSelection,
    universeAssets,
    isLoadingUniverse,
    tppMinWeight,
    setTppMinWeight,
    tppMaxWeight,
    setTppMaxWeight,
    stockCountMin,
    setStockCountMin,
    stockCountMax,
    setStockCountMax,
    maxAdditions,
    setMaxAdditions,
    maxAdditionsFloor: MAX_ADDITIONS_FLOOR,
    maxAdditionsCeiling: MAX_ADDITIONS_CEILING,
    complianceRows,
    canSubmit,
    isSubmitting,
    submitErrorMessage,
    submit,
  }
}
