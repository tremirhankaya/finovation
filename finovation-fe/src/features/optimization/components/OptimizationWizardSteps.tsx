import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type WizardStep = 1 | 2 | 3 | 4

type StepEntry = {
  step: WizardStep
  label: string
}

const STEPS: StepEntry[] = [
  { step: 1, label: "Fon Seçimi" },
  { step: 2, label: "Tercihler ve Kısıtlar" },
  { step: 3, label: "Sonuç ve Gerekçe" },
  { step: 4, label: "Onay" },
]

export type OptimizationWizardStepsProps = {
  currentStep: WizardStep
}

export default function OptimizationWizardSteps({
  currentStep,
}: OptimizationWizardStepsProps) {
  return (
    <ol className={styles.wizardSteps} aria-label="Optimizasyon adımları">
      {STEPS.map(({ step, label }) => {
        const isActive = step === currentStep
        const isDone = step < currentStep

        return (
          <li
            key={step}
            className={`${styles.wizardStep} ${
              isActive ? styles.wizardStepActive : ""
            }`}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={`${styles.wizardStepBadge} ${
                isActive || isDone ? styles.wizardStepBadgeActive : ""
              }`}
            >
              {step}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
