import { useCallback, useEffect, useMemo, useState } from "react"

import {
  approveOptimizationRequest,
  fetchOptimizationRequest,
  fetchOptimizationResult,
  rejectOptimizationRequest,
} from "@/features/optimization/api/optimizationApi"
import {
  evaluateConstraintMetrics,
  evaluateInfoMetrics,
  isApprovalBlockedByConstraints,
} from "@/features/optimization/lib/optimizationMetricsEvaluation"
import { buildConstraintMetricInput } from "@/features/optimization/lib/optimizationConstraintMetricInput"
import { buildCriteriaRows } from "@/features/optimization/lib/optimizationCriteriaRows"
import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import type {
  OptimizationResultAsset,
  OptimizationResultMetric,
} from "@/features/optimization/model/optimizationResultSchemas"
import type {
  RiskProfile,
  OptimizationRequestResponse,
} from "@/features/optimization/model/optimizationSchemas"

export type ReviewStep = 3 | 4
export type Decision = "approve" | "reject"

const REVIEWABLE_STATUSES = new Set(["COMPLETED"])
const RESULT_AVAILABLE_STATUSES = new Set(["COMPLETED", "APPROVED", "REJECTED"])

export function useOptimizationResultReview(requestId: number) {
  const [request, setRequest] = useState<OptimizationRequestResponse | null>(
    null,
  )
  const [isLoadingRequest, setIsLoadingRequest] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState("")

  const [reviewStep, setReviewStep] = useState<ReviewStep>(3)
  const [assets, setAssets] = useState<OptimizationResultAsset[]>([])
  const [metrics, setMetrics] = useState<OptimizationResultMetric[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState("")
  const [decidedAs, setDecidedAs] = useState<Decision | null>(null)

  useEffect(() => {
    if (!Number.isFinite(requestId)) {
      setIsLoadingRequest(false)
      setLoadErrorMessage("Geçersiz optimizasyon isteği.")
      return
    }

    let cancelled = false

    async function load() {
      setIsLoadingRequest(true)
      setLoadErrorMessage("")

      try {
        const current = await fetchOptimizationRequest(requestId)
        if (!cancelled) {
          setRequest(current)
          if (current.status === "APPROVED") setDecidedAs("approve")
          if (current.status === "REJECTED") setDecidedAs("reject")
        }

        if (RESULT_AVAILABLE_STATUSES.has(current.status)) {
          const result = await fetchOptimizationResult(requestId)
          if (!cancelled) {
            setAssets(result.assets)
            setMetrics(result.metrics)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setRequest(null)
          setLoadErrorMessage(getOptimizationErrorMessage(error))
        }
      } finally {
        if (!cancelled) setIsLoadingRequest(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestId])

  const isReviewable =
    request != null && REVIEWABLE_STATUSES.has(request.status)

  const setFinalWeight = useCallback((assetCode: string, value: number) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.assetCode === assetCode
          ? {
              ...asset,
              finalWeight: value,
              manuallyOverridden: value !== asset.proposedWeight,
            }
          : asset,
      ),
    )
  }, [])

  const resetFinalWeight = useCallback((assetCode: string) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.assetCode === assetCode
          ? { ...asset, finalWeight: null, manuallyOverridden: false }
          : asset,
      ),
    )
  }, [])

  const summary = useMemo(
    () => ({
      increasedCount: assets.filter((asset) => asset.actionType === "INCREASE")
        .length,
      decreasedCount: assets.filter((asset) => asset.actionType === "DECREASE")
        .length,
      keptCount: assets.filter((asset) => asset.actionType === "KEEP").length,
      overriddenCount: assets.filter((asset) => asset.manuallyOverridden)
        .length,
    }),
    [assets],
  )

  const constraintMetrics = useMemo(
    () =>
      evaluateConstraintMetrics(
        buildConstraintMetricInput(
          assets,
          request?.tppMinWeight ?? null,
          request?.tppMaxWeight ?? null,
          request?.stockCountMin ?? null,
          request?.stockCountMax ?? null,
        ),
      ),
    [assets, request],
  )

  const infoMetrics = useMemo(() => {
    const riskProfile: RiskProfile = request?.riskProfile ?? "BALANCED"
    const { current, proposed } = buildRiskMetricsSnapshots(metrics)
    return evaluateInfoMetrics(current, proposed, riskProfile)
  }, [metrics, request?.riskProfile])

  const isApprovalBlocked = useMemo(
    () => isApprovalBlockedByConstraints(constraintMetrics),
    [constraintMetrics],
  )

  const criteriaRows = useMemo(
    () =>
      buildCriteriaRows(
        assets,
        constraintMetrics,
        infoMetrics,
        request?.tppMinWeight ?? null,
        request?.tppMaxWeight ?? null,
        request?.stockCountMin ?? null,
        request?.stockCountMax ?? null,
      ),
    [assets, constraintMetrics, infoMetrics, request],
  )

  const goToApproval = useCallback(() => setReviewStep(4), [])
  const goToResult = useCallback(() => setReviewStep(3), [])

  const decide = useCallback(
    async (decision: Decision) => {
      if (decision === "approve" && isApprovalBlocked) return

      setIsSubmitting(true)
      setSubmitErrorMessage("")

      try {
        if (decision === "approve") {
          const weightOverrides = assets
            .filter(
              (asset) => asset.manuallyOverridden && asset.finalWeight != null,
            )
            .map((asset) => ({
              assetCode: asset.assetCode,
              finalWeight: asset.finalWeight as number,
            }))
          setRequest(await approveOptimizationRequest(requestId, weightOverrides))
        } else {
          setRequest(await rejectOptimizationRequest(requestId))
        }
        setDecidedAs(decision)
      } catch (error) {
        setSubmitErrorMessage(getOptimizationErrorMessage(error))
      } finally {
        setIsSubmitting(false)
      }
    },
    [requestId, isApprovalBlocked, assets],
  )

  return {
    constraintMetrics,
    infoMetrics,
    criteriaRows,
    isApprovalBlocked,
    request,
    isLoadingRequest,
    loadErrorMessage,
    isReviewable,
    reviewStep,
    goToApproval,
    goToResult,
    assets,
    setFinalWeight,
    resetFinalWeight,
    summary,
    isSubmitting,
    submitErrorMessage,
    decidedAs,
    decide,
  }
}
