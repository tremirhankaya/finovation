import type { ComponentType } from "react"

import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

function ProtectiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 7v5.2c0 4.2-2.8 7.4-7 8.8-4.2-1.4-7-4.6-7-8.8V7l7-3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BalancedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v16M5 9h14M7.5 9 5 14h5M16.5 9 19 14h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AggressiveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  )
}

const RISK_PROFILE_OPTIONS: Array<{
  value: RiskProfile
  label: string
  Icon: ComponentType
  description: string
}> = [
  {
    value: "CONSERVATIVE",
    label: "Korumacı",
    Icon: ProtectiveIcon,
    description: "Kısa dalgalanmalar yerine kalıcı eğilimlere ağırlık verir",
  },
  {
    value: "BALANCED",
    label: "Dengeli",
    Icon: BalancedIcon,
    description: "Güncel fırsatlarla kalıcı eğilimleri birlikte değerlendirir",
  },
  {
    value: "AGGRESSIVE",
    label: "Agresif",
    Icon: AggressiveIcon,
    description: "Kısa dönem hareketlerine daha hızlı tepki verir",
  },
]

export type RiskProfilePanelProps = {
  value: RiskProfile
  onChange: (value: RiskProfile) => void
}

export default function RiskProfilePanel({
  value,
  onChange,
}: RiskProfilePanelProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>A · Optimizasyon Yaklaşımı</h2>
      <div
        className={styles.riskOptions}
        role="radiogroup"
        aria-label="Optimizasyon yaklaşımı"
      >
        {RISK_PROFILE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={`${styles.riskOption} ${
              value === option.value ? styles.riskOptionSelected : ""
            }`}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.riskOptionIcon}>
              <option.Icon />
            </span>
            <span className={styles.riskOptionLabel}>{option.label}</span>
            <span className={styles.riskOptionDescription}>
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
