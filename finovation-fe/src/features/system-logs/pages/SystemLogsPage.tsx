import styles from "@/features/system-logs/styles/SystemLogsPage.module.css"

const PREVIEW_LINES = [
  {
    time: "14:32:08.421",
    level: "INFO",
    service: "backend",
    message: "Uygulama log akışı bağlantı bekliyor.",
  },
  {
    time: "14:32:08.422",
    level: "WARN",
    service: "marketdata",
    message: "Bu satırlar yalnız ekran tasarımı önizlemesidir.",
  },
] as const

export default function SystemLogsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Sistem Yönetimi</p>
          <h1>Log İzleme</h1>
          <p>
            Uygulama servislerinin terminal çıktılarını tek ekrandan takip edin.
          </p>
        </div>
        <span className={styles.connectionBadge}>
          <span aria-hidden="true" /> Backend bağlantısı bekleniyor
        </span>
      </header>

      <section className={styles.summaryGrid} aria-label="Log özeti önizlemesi">
        <article>
          <span>Toplam log</span>
          <strong>—</strong>
          <small>Bağlantı kurulduğunda güncellenecek</small>
        </article>
        <article>
          <span>Uyarılar</span>
          <strong className={styles.warningValue}>—</strong>
          <small>WARN seviyesindeki kayıtlar</small>
        </article>
        <article>
          <span>Hatalar</span>
          <strong className={styles.errorValue}>—</strong>
          <small>ERROR seviyesindeki kayıtlar</small>
        </article>
      </section>

      <section className={styles.logCard} aria-labelledby="log-stream-title">
        <div className={styles.toolbar}>
          <div>
            <h2 id="log-stream-title">Canlı Log Akışı</h2>
            <p>Backend entegrasyonu sonraki geliştirmede bağlanacaktır.</p>
          </div>
          <div
            className={styles.filters}
            aria-label="Log filtreleri önizlemesi"
          >
            <label>
              <span>Servis</span>
              <select disabled defaultValue="all">
                <option value="all">Tüm servisler</option>
              </select>
            </label>
            <label>
              <span>Seviye</span>
              <select disabled defaultValue="all">
                <option value="all">Tüm seviyeler</option>
              </select>
            </label>
            <label className={styles.searchField}>
              <span>Loglarda ara</span>
              <input
                disabled
                type="search"
                placeholder="Mesaj veya servis ara"
              />
            </label>
          </div>
        </div>

        <div
          className={styles.terminal}
          aria-label="Terminal logları tasarım önizlemesi"
        >
          <div className={styles.terminalHead}>
            <span className={styles.terminalDots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>finovation / live-logs</span>
            <span className={styles.previewLabel}>TASARIM ÖNİZLEMESİ</span>
          </div>
          <div className={styles.terminalBody}>
            {PREVIEW_LINES.map((line) => (
              <p key={`${line.time}-${line.level}`}>
                <time>{line.time}</time>
                <strong className={styles[`level${line.level}`]}>
                  {line.level}
                </strong>
                <span className={styles.service}>[{line.service}]</span>
                <span>{line.message}</span>
              </p>
            ))}
            <div className={styles.emptyState}>
              <span aria-hidden="true">⌁</span>
              <strong>Henüz gerçek log verisi alınmıyor</strong>
              <p>
                Log endpointi veya canlı akış bağlandığında kayıtlar burada
                görünecek.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
