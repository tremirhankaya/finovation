import styles from "@/features/fund-design/styles/FundDesignSkeleton.module.css"

type FundDesignSkeletonProps = {
  step: number
}

const COPY: Record<number, string> = {
  1: "Fon bilgileri hazırlanıyor",
  2: "Portföy kuralları hazırlanıyor",
  3: "AI analiz ortamı hazırlanıyor",
  4: "Portföy alternatifleri hazırlanıyor",
  5: "Portföy düzenleme alanı hazırlanıyor",
  6: "Fon özeti hazırlanıyor",
  7: "Fon sonuçları hazırlanıyor",
}

export default function FundDesignSkeleton({ step }: FundDesignSkeletonProps) {
  const rows = step === 5 ? 6 : step === 6 ? 5 : 3

  return (
    <section className={styles.shell} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>{COPY[step] ?? "Yükleniyor"}</span>
      <div className={styles.topLine} />
      <div className={styles.titleLine} />
      <div className={styles.descriptionLine} />
      <div className={styles.grid}>
        <div className={styles.mainCard}>
          <div className={styles.cardHeading} />
          <div className={styles.metricRow}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.rowStack}>
            {Array.from({ length: rows }, (_, index) => (
              <span className={styles.row} key={index} />
            ))}
          </div>
        </div>
        <div className={styles.sideCard}>
          <div className={styles.cardHeading} />
          <div className={styles.progressTrack}>
            <span />
          </div>
          <div className={styles.shortLine} />
          <div className={styles.shortLine} />
        </div>
      </div>
    </section>
  )
}
