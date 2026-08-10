import { useEffect, useState } from "react"

import styles from "@/features/optimization/styles/OptimizationRunningPage.module.css"

const STEPS = [
  "Mevcut fon dağılımı alınıyor",
  "Sabit tutulacak hisseler ve ağırlıkları kilitleniyor",
  "Eklenmek ve çıkarılmak istenen hisseler zorunlu olarak işaretleniyor",
  "Yatırım evreni değerlendiriliyor",
  "Optimizasyon yaklaşımı ve vade modele iletiliyor",
  "TPP ağırlık aralığı uygulanıyor",
  "Hisse sayısı sınırları uygulanıyor",
  "İzahname kuralları uygulanıyor",
  "Optimize edilmiş portföy dağılımı üretiliyor",
  "Model gerekçeleri oluşturuluyor",
] as const

const STEP_INTERVAL_MS = 1100
const LAST_RUNNING_STEP_INDEX = STEPS.length - 2

export type OptimizationRunningStepsProps = {
  isRunning: boolean
  isCompleted: boolean
}

export default function OptimizationRunningSteps({
  isRunning,
  isCompleted,
}: OptimizationRunningStepsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!isRunning) return

    setActiveIndex(0)
    const timer = window.setInterval(() => {
      setActiveIndex((current) =>
        current < LAST_RUNNING_STEP_INDEX ? current + 1 : current,
      )
    }, STEP_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [isRunning])

  useEffect(() => {
    if (isCompleted) setActiveIndex(STEPS.length - 1)
  }, [isCompleted])

  return (
    <div className={styles.runningStepsBlock}>
      <div
        key={activeIndex}
        className={styles.activeStepCard}
        aria-live="polite"
      >
        <span
          className={
            isCompleted
              ? styles.activeStepDotDone
              : styles.activeStepDotSpinning
          }
          aria-hidden="true"
        />
        <span className={styles.activeStepLabel}>{STEPS[activeIndex]}</span>
        <span className={styles.activeStepCount}>
          {activeIndex + 1} / {STEPS.length}
        </span>
      </div>

      <ul className={styles.steps} aria-label="Optimizasyon adımları">
        {STEPS.map((step, index) => {
          const state =
            index < activeIndex || (isCompleted && index <= activeIndex)
              ? "done"
              : index === activeIndex
                ? "active"
                : "pending"

          return (
            <li
              key={step}
              className={[
                styles.step,
                state === "done" ? styles.stepDone : "",
                state === "active" ? styles.stepActive : "",
                state === "pending" ? styles.stepPending : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.stepIcon} aria-hidden="true">
                {state === "done" ? "✓" : ""}
              </span>
              {step}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
