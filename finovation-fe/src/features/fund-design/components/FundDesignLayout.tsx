import type { ReactNode } from "react"

import styles from "@/features/fund-design/styles/FundDesignLayout.module.css"

const STEPS = [
  "Taslağı Başlat",
  "Strateji",
  "AI Analizi",
  "Alternatifler",
  "Düzenleme",
  "Onay",
] as const

type FundDesignLayoutProps = {
  step: number
  children: ReactNode
}

export default function FundDesignLayout({
  step,
  children,
}: FundDesignLayoutProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Destekli Fon Tasarımı</h1>
        <p className={styles.subtitle}>
          Adım {step} / {STEPS.length} - {STEPS[step - 1]}
        </p>
      </header>

      <ol className={styles.steps}>
        {STEPS.map((label, index) => {
          const stepNumber = index + 1
          const isCurrent = stepNumber === step

          return (
            <li
              key={label}
              className={[styles.step, isCurrent && styles.stepCurrent]
                .filter(Boolean)
                .join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={styles.stepIndex}>{stepNumber}</span>
              <span className={styles.stepLabel}>{label}</span>
            </li>
          )
        })}
      </ol>

      {children}
    </div>
  )
}
