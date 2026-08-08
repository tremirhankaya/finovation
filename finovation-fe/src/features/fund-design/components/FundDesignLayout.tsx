import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router"

import styles from "@/features/fund-design/styles/FundDesignLayout.module.css"

const STEPS = [
  "Taslağı Başlat",
  "Strateji",
  "AI Analizi",
  "Alternatifler",
  "Düzenleme",
  "Onay",
  "Tamamlandı",
] as const

function pathForStep(stepNumber: number, draftId: string | undefined): string | null {
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
  children: ReactNode
}

export default function FundDesignLayout({
  step,
  wide = false,
  children,
}: FundDesignLayoutProps) {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const currentLabel = STEPS[step - 1] ?? STEPS[0]

  return (
    <div className={[styles.page, wide && styles.pageWide].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Destekli Fon Tasarımı</h1>
        <p className={styles.subtitle}>
          Adım {step} / {STEPS.length} - {currentLabel}
        </p>
      </header>

      <ol className={styles.steps}>
        {STEPS.map((label, index) => {
          const stepNumber = index + 1
          const isCurrent = stepNumber === step
          const isDone = stepNumber < step
          const targetPath = pathForStep(stepNumber, draftId)
          const canNavigate = isDone && targetPath != null

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
                  <span className={styles.stepIndex}>{stepNumber}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              ) : (
                <>
                  <span className={styles.stepIndex}>{stepNumber}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </>
              )}
            </li>
          )
        })}
      </ol>

      {children}
    </div>
  )
}
