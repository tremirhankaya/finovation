import { useNavigate } from "react-router"

import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export default function NoFundsAvailableStep() {
  const navigate = useNavigate()

  return (
    <section className={styles.panel}>
      <div className={styles.emptyState}>
        <span className={styles.emptyStateIcon} aria-hidden="true" />
        <h3 className={styles.emptyStateTitle}>
          Optimize edilebilecek bir fon bulunamadı.
        </h3>
        <p className={styles.emptyStateDescription}>
          Fon optimizasyonu yapabilmek için öncelikle Fon Oluşturma modülünde
          bir fon oluşturmanız gerekmektedir.
        </p>
        <div className={styles.emptyStateActions}>
          <button
            type="button"
            className={styles.submitButton}
            onClick={() => navigate("/fund-design")}
          >
            Fon Oluşturma Ekranına Git
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => navigate("/dashboard")}
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    </section>
  )
}
