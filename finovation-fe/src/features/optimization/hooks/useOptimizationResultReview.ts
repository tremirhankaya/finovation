import { useCallback, useEffect, useMemo, useState } from "react"

import {
  approveOptimizationRequest,
  fetchOptimizationRequest,
  rejectOptimizationRequest,
} from "@/features/optimization/api/optimizationApi"
import {
  evaluateConstraintMetrics,
  evaluateInfoMetrics,
  isApprovalBlockedByConstraints,
} from "@/features/optimization/lib/optimizationMetricsEvaluation"
import {
  PLACEHOLDER_CONSTRAINT_METRIC_INPUT,
  PLACEHOLDER_CURRENT_RISK_METRICS,
  PLACEHOLDER_PROPOSED_RISK_METRICS,
} from "@/features/optimization/lib/optimizationMetricsPlaceholder"
import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import { PLACEHOLDER_OPTIMIZATION_RESULT } from "@/features/optimization/lib/optimizationResultPlaceholder"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import type {
  RiskProfile,
  OptimizationRequestResponse,
} from "@/features/optimization/model/optimizationSchemas"

export type ReviewStep = 3 | 4
export type Decision = "approve" | "reject"

const REVIEWABLE_STATUSES = new Set(["COMPLETED"])

export function useOptimizationResultReview(requestId: number) {
  const [request, setRequest] = useState<OptimizationRequestResponse | null>(
    null,
  )
  const [isLoadingRequest, setIsLoadingRequest] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState("")

  const [reviewStep, setReviewStep] = useState<ReviewStep>(3)
  const [assets, setAssets] = useState<OptimizationResultAsset[]>(
    PLACEHOLDER_OPTIMIZATION_RESULT.assets,
  )
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
    () => evaluateConstraintMetrics(PLACEHOLDER_CONSTRAINT_METRIC_INPUT),
    [],
  )

  const infoMetrics = useMemo(() => {
    const riskProfile: RiskProfile = request?.riskProfile ?? "BALANCED"
    return evaluateInfoMetrics(
      PLACEHOLDER_CURRENT_RISK_METRICS,
      PLACEHOLDER_PROPOSED_RISK_METRICS,
      riskProfile,
    )
  }, [request?.riskProfile])

  const isApprovalBlocked = useMemo(
    () => isApprovalBlockedByConstraints(constraintMetrics),
    [constraintMetrics],
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
          await approveOptimizationRequest(requestId)
        } else {
          await rejectOptimizationRequest(requestId)
        }
        setDecidedAs(decision)
      } catch (error) {
        setSubmitErrorMessage(getOptimizationErrorMessage(error))
      } finally {
        setIsSubmitting(false)
      }
    },
    [requestId, isApprovalBlocked],
  )

  return {
    constraintMetrics,
    infoMetrics,
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
