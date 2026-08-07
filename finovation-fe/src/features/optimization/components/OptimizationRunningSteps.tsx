import styles from "@/features/optimization/styles/OptimizationRunningPage.module.css"

const STEPS = [
  "Mevcut fon dağılımı alınıyor",
  "Sabit tutulacak hisseler ve ağırlıkları kilitleniyor",
  "Eklenmek istenen hisseler aday / zorunlu olarak işaretleniyor",
  "58 hisselik yatırım evreni değerlendiriliyor",
  "Optimizasyon yaklaşımı modele iletiliyor",
  "TPP ağırlık aralığı uygulanıyor",
  "Hisse sayısı sınırları uygulanıyor",
  "Tek hisse ve sektör sınırları uygulanıyor",
  "Optimize edilmiş portföy dağılımı üretiliyor",
  "Model gerekçeleri oluşturuluyor",
] as const

export default function OptimizationRunningSteps() {
  return (
    <ul className={styles.steps} aria-label="Optimizasyon adımları">
      {STEPS.map((step) => (
        <li key={step} className={styles.step}>
          {step}
        </li>
      ))}
    </ul>
  )
}
