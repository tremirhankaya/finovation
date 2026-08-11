import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router"

import FundDesignSkeleton from "@/features/fund-design/components/FundDesignSkeleton"
import styles from "@/features/fund-design/styles/FundDesignLayout.module.css"

const AI_STEPS = [
  "Taslağı Başlat",
  "Strateji",
  "AI Analizi",
  "Alternatifler",
  "Düzenleme",
  "Onay",
  "Tamamlandı",
] as const

const MANUAL_STEPS = ["Taslağı Başlat", "Portföy", "Onay"] as const

const MANUAL_INTERNAL_STEPS = [1, 5, 6] as const

const COMPLETED_STEP = 7

function pathForStep(
  stepNumber: number,
  draftId: string | undefined,
): string | null {
  switch (stepNumber) {
    case 1:
      return "/fund-design/new"
    case 2:
      return draftId ? `/fund-design/${draftId}/strategy` : null
    case 3:
      return draftId ? `/fund-design/${draftId}/analysis` : null
    case 4:
      return draftId ? `/fund-design/${draftId}/alternatives` : null
    case 5:
      return draftId ? `/fund-design/${draftId}/edit` : null
    case 6:
      return draftId ? `/fund-design/${draftId}/approve` : null
    case 7:
      return draftId ? `/fund-design/${draftId}/completed` : null
    default:
      return null
  }
}

type FundDesignLayoutProps = {
  step: number
  wide?: boolean
  designMode?: "AI_ASSISTED" | "MANUAL"
  isLoading?: boolean
  children: ReactNode
}

export default function FundDesignLayout({
  step,
  wide = false,
  designMode = "AI_ASSISTED",
  isLoading = false,
  children,
}: FundDesignLayoutProps) {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const isManual = designMode === "MANUAL"
  const stepsList = isManual ? MANUAL_STEPS : AI_STEPS
  const isManualCompleted = isManual && step === COMPLETED_STEP

  const manualIndex = MANUAL_INTERNAL_STEPS.indexOf(
    step as (typeof MANUAL_INTERNAL_STEPS)[number],
  )
  const visualStep = isManual
    ? manualIndex === -1
      ? stepsList.length
      : manualIndex + 1
    : step
  return (
    <div
      className={[styles.page, wide && styles.pageWide]
        .filter(Boolean)
        .join(" ")}
    >
      {!isLoading && (
        <div className={styles.navigationRow}>
          <ol className={styles.steps} data-fund-design-steps>
            {stepsList.map((label, index) => {
              const visualStepNumber = index + 1
              const internalStepNumber = isManual
                ? MANUAL_INTERNAL_STEPS[index]
                : visualStepNumber
              const isCurrent =
                !isManualCompleted && visualStepNumber === visualStep
              const isDone = isManualCompleted || visualStepNumber < visualStep
              const isFinalized = step === COMPLETED_STEP
              const targetPath = pathForStep(internalStepNumber, draftId)
              const canNavigate = isDone && targetPath != null && !isFinalized

              return (
                <li
                  key={label}
                  className={[
                    styles.step,
                    isCurrent && styles.stepCurrent,
                    isDone && styles.stepDone,
                    canNavigate && styles.stepClickable,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {canNavigate ? (
                    <button
                      type="button"
                      className={styles.stepButton}
                      title={`${label} adımına dön`}
                      aria-label={`${label} adımına dön`}
                      onClick={() => void navigate(targetPath)}
                    >
                      <span className={styles.stepIndex}>{visualStepNumber}</span>
                      <span className={styles.stepLabel}>{label}</span>
                    </button>
                  ) : (
                    <>
                      <span className={styles.stepIndex}>{visualStepNumber}</span>
                      <span className={styles.stepLabel}>{label}</span>
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className={styles.content}>
        {isLoading ? <FundDesignSkeleton step={step} /> : children}
      </div>
    </div>
  )
}
