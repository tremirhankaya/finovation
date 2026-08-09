import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

const RISK_PROFILE_OPTIONS: Array<{
  value: RiskProfile
  label: string
  emoji: string
  description: string
}> = [
  {
    value: "AGGRESSIVE",
    label: "Agresif",
    emoji: "😤",
    description: "Kısa dönem hareketlerine daha hızlı tepki verir",
  },
  {
    value: "BALANCED",
    label: "Dengeli",
    emoji: "⚖️",
    description: "Güncel fırsatlarla kalıcı eğilimleri birlikte değerlendirir",
  },
  {
    value: "CONSERVATIVE",
    label: "Korumacı",
    emoji: "😇",
    description: "Kısa dalgalanmalar yerine kalıcı eğilimlere ağırlık verir",
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
            <span className={styles.riskOptionLabel}>
              <span aria-hidden="true">{option.emoji}</span> {option.label}
            </span>
            <span className={styles.riskOptionDescription}>
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
