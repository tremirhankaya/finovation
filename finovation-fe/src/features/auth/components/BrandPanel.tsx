import Logo from "@/shared/ui/Logo"
import styles from "@/features/auth/styles/BrandPanel.module.css"
import CheckIcon from "./CheckIcon"

const FEATURES = [
  {
    title: "Fon portföyü optimizasyonu",
    description: "Çok faktörlü risk analizi",
  },
  {
    title: "Yapay zekâ içgörüleri",
    description: "Açıklanabilir karar desteği",
  },
  {
    title: "Senaryo ve stres testleri",
    description: "Piyasa simülasyonları",
  },
] as const

export default function BrandPanel() {
  return (
    <aside className={styles.panel}>
      <div className={styles.grid} aria-hidden="true" />
      <Logo />

      <div className={styles.content}>
        <div>
          <h2>
            Yapay zekâ destekli
            <br />
            fon karar platformu
          </h2>
          <p>
            Portföyünü analiz et, senaryoları test et ve kararlarını
            açıklanabilir içgörülerle güçlendir.
          </p>
        </div>

        <ul className={styles.featureList}>
          {FEATURES.map(({ title, description }) => (
            <li key={title} className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <CheckIcon />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.disclaimer}>
        Simülasyon ve karar destek platformudur. Gerçek emir iletimi yapılmaz.
        Geçmiş veya sentetik verilerle çalışır.
      </p>
    </aside>
  )
}
