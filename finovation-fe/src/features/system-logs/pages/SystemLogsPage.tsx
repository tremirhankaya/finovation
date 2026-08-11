import { useEffect, useMemo, useState } from "react"

import { getSystemLogs } from "@/features/system-logs/api/systemLogsService"
import type {
  SystemLog,
  SystemLogLevel,
} from "@/features/system-logs/model/systemLogTypes"
import styles from "@/features/system-logs/styles/SystemLogsPage.module.css"

const LEVELS: SystemLogLevel[] = [
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
]

const LOG_LIMIT = 200
const REFRESH_INTERVAL_MS = 5000

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [service, setService] = useState("")
  const [level, setLevel] = useState("")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadLogs() {
    try {
      setError(null)

      const data = await getSystemLogs({
        service: service || undefined,
        level: level || undefined,
        search: search.trim() || undefined,
        limit: LOG_LIMIT,
      })

      setLogs(data)
    } catch {
      setError("Log kayıtları alınamadı.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()

    const intervalId = window.setInterval(
        () => void loadLogs(),
        REFRESH_INTERVAL_MS,
    )

    return () => window.clearInterval(intervalId)
  }, [service, level, search])

  const services = useMemo(
      () =>
          [...new Set(logs.map((log) => log.service))]
              .filter(Boolean)
              .sort(),
      [logs],
  )

  const warningCount = logs.filter(
      (log) => log.level === "WARN",
  ).length

  const errorCount = logs.filter(
      (log) => log.level === "ERROR",
  ).length

  return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Sistem Yönetimi</p>
            <h1>Log İzleme</h1>
            <p>
              Uygulama servislerinin log kayıtlarını tek ekrandan takip edin.
            </p>
          </div>

          <span className={styles.connectionBadge}>
          <span aria-hidden="true" />
            {error ? "Bağlantı hatası" : "Bağlantı aktif"}
        </span>
        </header>

        <section className={styles.summaryGrid}>
          <article>
            <span>Toplam log</span>
            <strong>{logs.length}</strong>
            <small>Son {LOG_LIMIT} kayıt</small>
          </article>

          <article>
            <span>Uyarılar</span>
            <strong className={styles.warningValue}>
              {warningCount}
            </strong>
            <small>WARN seviyesindeki kayıtlar</small>
          </article>

          <article>
            <span>Hatalar</span>
            <strong className={styles.errorValue}>
              {errorCount}
            </strong>
            <small>ERROR seviyesindeki kayıtlar</small>
          </article>
        </section>

        <section className={styles.logCard}>
          <div className={styles.toolbar}>
            <div>
              <h2>Canlı Log Akışı</h2>
              <p>Loglar her 5 saniyede otomatik yenilenir.</p>
            </div>

            <div className={styles.filters}>
              <label>
                <span>Servis</span>

                <select
                    value={service}
                    onChange={(event) => setService(event.target.value)}
                >
                  <option value="">Tüm servisler</option>

                  {services.map((serviceName) => (
                      <option key={serviceName} value={serviceName}>
                        {serviceName}
                      </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Seviye</span>

                <select
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                >
                  <option value="">Tüm seviyeler</option>

                  {LEVELS.map((logLevel) => (
                      <option key={logLevel} value={logLevel}>
                        {logLevel}
                      </option>
                  ))}
                </select>
              </label>

              <label className={styles.searchField}>
                <span>Loglarda ara</span>

                <input
                    type="search"
                    value={search}
                    placeholder="Mesaj içinde ara"
                    onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.terminal}>
            <div className={styles.terminalHead}>
            <span
                className={styles.terminalDots}
                aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>

              <span>finovation / live-logs</span>

              <span className={styles.previewLabel}>
              {isLoading ? "YÜKLENİYOR" : "CANLI"}
            </span>
            </div>

            <div className={styles.terminalBody}>
              {error && <p>{error}</p>}

              {!error && !isLoading && logs.length === 0 && (
                  <p>Log kaydı bulunamadı.</p>
              )}

              {!error &&
                  logs.map((log) => (
                      <p
                          key={`${log.timestamp}-${log.service}-${log.message}`}
                      >
                        <time>
                          {new Date(log.timestamp).toLocaleTimeString(
                              "tr-TR",
                              { hour12: false },
                          )}
                        </time>

                        <strong
                            className={styles[`level${log.level}`]}
                        >
                          {log.level}
                        </strong>

                        <span className={styles.service}>
                    [{log.service}]
                  </span>

                        <span>{log.message}</span>
                      </p>
                  ))}
            </div>
          </div>
        </section>
      </main>
  )
}