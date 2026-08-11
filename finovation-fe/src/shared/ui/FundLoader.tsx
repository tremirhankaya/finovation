import styles from "./FundLoader.module.css"

export function FundLoader({
  message = "Yükleniyor...",
}: {
  message?: string
}) {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.spinner} />
      <p className={styles.message}>{message}</p>
    </div>
  )
}
