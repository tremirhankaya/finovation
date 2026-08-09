import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { listCompletedDrafts, type FundDraftSummary } from "@/features/fund-design/api/fundDraftApi"
import styles from "@/features/fund-design/styles/FundDesignLandingPage.module.css"

export default function FundActivePage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<FundDraftSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    listCompletedDrafts(controller.signal)
      .then((data) => {
        setDrafts(data)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        console.error("Aktif fonlar alınamadı", err)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.draftsSection}>
          <h2 className={styles.sectionTitle}>Aktif Fonlarınız</h2>
          {loading ? (
            <p className={styles.loadingText}>Yükleniyor...</p>
          ) : drafts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Henüz aktif (tasarımı tamamlanmış) bir fonunuz bulunmuyor.</p>
            </div>
          ) : (
            <div className={styles.draftsList}>
              {drafts.map((draft) => (
                <div
                  key={draft.draftId}
                  className={styles.draftCard}
                  onClick={() => navigate(`/fund-design/${draft.draftId}/completed`)}
                >
                  <div className={styles.draftInfo}>
                    <h3 className={styles.draftName}>{draft.name}</h3>
                    <div className={styles.draftMeta}>
                      <span className={[styles.statusBadge, styles.statusCompleted].join(" ")}>
                        Tamamlandı
                      </span>
                      <span className={styles.draftDate}>
                        Tasarım Tarihi: {new Date(draft.updatedAt).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                  <div className={styles.draftAction}>
                    ➔
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
