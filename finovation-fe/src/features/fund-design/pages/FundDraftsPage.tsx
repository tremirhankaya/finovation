import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { listInProgressDrafts, type FundDraftSummary } from "@/features/fund-design/api/fundDraftApi"
import Button from "@/shared/ui/Button"
import styles from "@/features/fund-design/styles/FundDesignLandingPage.module.css"

export default function FundDraftsPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<FundDraftSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    listInProgressDrafts(controller.signal)
      .then((data) => {
        setDrafts(data)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        console.error("Taslaklar alınamadı", err)
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.heroSection}>
          <h1 className={styles.heroTitle}>Yeni Fon Tasarımı</h1>
          <p className={styles.heroSubtitle}>
            Sıfırdan yepyeni bir fon stratejisi oluşturabilir veya daha önce başladığınız taslaklara geri dönebilirsiniz.
          </p>
        </div>

        <div className={styles.actionGrid}>
          <div className={styles.actionCard}>
            <div className={styles.iconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <h2 className={styles.actionTitle}>Sıfırdan Başla</h2>
            <p className={styles.actionDesc}>
              Yapay zeka destekli yeni bir fon portföyü ve stratejisi yaratmak için ilk adımı atın.
            </p>
            <Button
              className={styles.startButton}
              onClick={() => navigate("/fund-design/new")}
            >
              Yeni Taslak Başlat
            </Button>
          </div>

          <div className={styles.actionCard}>
            <div className={styles.iconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h2 className={styles.actionTitle}>Taslaklardan Devam Et</h2>
            <p className={styles.actionDesc}>
              Daha önce başladığınız ama henüz tamamlamadığınız fon tasarımlarına geri dönün.
            </p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                document.getElementById("drafts-list")?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Taslakları Görüntüle
            </button>
          </div>
        </div>

        <div id="drafts-list" className={styles.draftsSection}>
          <h2 className={styles.sectionTitle}>Fon Taslaklarınız</h2>
          {loading ? (
            <p className={styles.loadingText}>Yükleniyor...</p>
          ) : drafts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Henüz oluşturulmuş bir fon taslağınız bulunmuyor.</p>
            </div>
          ) : (
            <div className={styles.draftsList}>
              {drafts.map((draft) => (
                <div
                  key={draft.draftId}
                  className={styles.draftCard}
                  onClick={() => navigate(`/fund-design/${draft.draftId}/${
                    draft.status === "COMPLETED" ? "completed"
                      : draft.currentStep === 2 ? "strategy"
                      : draft.currentStep === 3 ? "analysis"
                      : draft.currentStep === 4 ? "alternatives"
                      : draft.currentStep === 5 ? "edit"
                      : draft.currentStep === 6 ? "approve"
                      : "strategy"
                  }`)}
                >
                  <div className={styles.draftInfo}>
                    <h3 className={styles.draftName}>{draft.name}</h3>
                    <div className={styles.draftMeta}>
                      <span className={[
                        styles.statusBadge,
                        draft.status === "COMPLETED" ? styles.statusCompleted : styles.statusInProgress
                      ].join(" ")}>
                        {draft.status === "COMPLETED" ? "Tamamlandı" : `Devam Ediyor (Adım ${draft.currentStep})`}
                      </span>
                      <span className={styles.draftDate}>
                        Son Güncelleme: {new Date(draft.updatedAt).toLocaleDateString("tr-TR")}
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
