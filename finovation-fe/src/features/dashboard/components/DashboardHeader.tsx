import DashboardIcon from "@/features/dashboard/components/DashboardIcon"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

type DashboardHeaderProps = {
  firstName?: string
  businessDate?: string | null
  isRefreshing: boolean
  onRefresh: () => void
}

export default function DashboardHeader({
  firstName,
  businessDate,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowIcon}>
            <DashboardIcon name="home" />
          </span>
          Genel Bakış
        </div>
        <h1>{firstName ? `Merhaba, ${firstName}` : "Ana Sayfa"}</h1>
        <p>
          Fonlarınızın performansını, optimizasyonlarını ve risk görünümünü tek
          ekrandan takip edin.
        </p>
      </div>

      <div className={styles.headerMeta}>
        <time dateTime={businessDate ?? undefined}>
          {businessDate
            ? dateFormatter.format(new Date(`${businessDate}T00:00:00`))
            : "Veri tarihi yükleniyor…"}
        </time>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <DashboardIcon name="refresh" />
          {isRefreshing ? "Yenileniyor…" : "Verileri Yenile"}
        </button>
      </div>
    </header>
  )
}
