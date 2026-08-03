import styles from "@/app/router/RouteStatus.module.css"

type RouteStatusProps = {
  mode: "error"
  message: string
  onRetry: () => void
}

export default function RouteStatus(props: RouteStatusProps) {
  return (
    <main className={styles.page}>
      <div className={styles.card} role="alert">
        <h1>Bağlantı kurulamadı</h1>
        <p>{props.message}</p>
        <button type="button" onClick={props.onRetry}>
          Tekrar dene
        </button>
      </div>
    </main>
  )
}
