import { useEffect, useState } from "react"

import styles from "@/features/fund-design/styles/FundDesignProgressRail.module.css"

const AI_STEPS = [
  "Taslağı Başlat",
  "Strateji",
  "AI Analizi",
  "Alternatifler",
  "Düzenleme",
  "Onay",
  "Tamamlandı",
]

const MANUAL_STEPS = ["Taslağı Başlat", "Portföy", "Onay"]

export default function FundDesignProgressRail({
  currentStep,
  designMode = "AI_ASSISTED",
}: {
  currentStep: number
  designMode?: "AI_ASSISTED" | "MANUAL"
}) {
  const [isVisible, setIsVisible] = useState(false)
  const steps = designMode === "MANUAL" ? MANUAL_STEPS : AI_STEPS

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const source = document.querySelector("[data-fund-design-steps]")
    if (!source) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.intersectionRatio < 0.15),
      { threshold: [0, 0.15] },
    )
    observer.observe(source)
    return () => observer.disconnect()
  }, [])

  return (
    <aside className={[styles.rail, isVisible && styles.railVisible].filter(Boolean).join(" ")} aria-label={`${designMode === "MANUAL" ? "Manuel" : "AI"} tasarım ilerlemesi`}>
      <div className={styles.head}><span>{designMode === "MANUAL" ? "Manuel tasarım" : "AI tasarım"}</span><strong>{currentStep} / {steps.length}</strong></div>
      <ol className={styles.list}>
        {steps.map((label, index) => {
          const number = index + 1
          return <li key={label} className={[styles.item, number < currentStep && styles.done, number === currentStep && styles.current].filter(Boolean).join(" ")}><i>{number < currentStep ? "✓" : number}</i><span>{label}</span></li>
        })}
      </ol>
    </aside>
  )
}
