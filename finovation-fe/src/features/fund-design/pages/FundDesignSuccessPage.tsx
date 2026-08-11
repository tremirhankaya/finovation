import { useEffect, useState } from "react"
import { useParams, Link } from "react-router"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import {
  getFundDraft,
  getFundEstimates,
  type FundEstimates,
} from "@/features/fund-design/api/fundDraftApi"
import type { FundDraft } from "@/features/fund-design/model/fundDraftSchemas"
import styles from "@/features/fund-design/styles/FundDesignSuccessPage.module.css"

const CheckCircleBigIcon = () => (
  <svg
    className={styles.successSvg}
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="32" cy="32" r="32" fill="#059669" />
    <path
      d="M19 32L28 41L45 24"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.successCheck}
    />
  </svg>
)

export default function FundDesignSuccessPage() {
  const { draftId } = useParams<{ draftId: string }>()
  const [estimates, setEstimates] = useState<FundEstimates | null>(null)
  const [draft, setDraft] = useState<FundDraft | null>(null)
  const [isDraftLoading, setIsDraftLoading] = useState(true)
  const [areEstimatesLoading, setAreEstimatesLoading] = useState(true)

  useEffect(() => {
    if (!draftId) return
    const controller = new AbortController()

    void (async () => {
      try {
        const loaded = await getFundDraft(draftId, controller.signal)
        if (!controller.signal.aborted) setDraft(loaded)
      } catch {
        if (controller.signal.aborted) return
      } finally {
        if (!controller.signal.aborted) setIsDraftLoading(false)
      }
    })()

    return () => controller.abort()
  }, [draftId])

  useEffect(() => {
    if (!draftId) return
    let active = true

    getFundEstimates(draftId)
      .then((loaded) => {
        if (active) setEstimates(loaded)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAreEstimatesLoading(false)
      })

    return () => {
      active = false
    }
  }, [draftId])

  return (
    <FundDesignLayout
      step={7}
      designMode={draft?.designMode ?? "AI_ASSISTED"}
      isLoading={isDraftLoading}
      wide
    >
      <div className={styles.container}>
        <div className={styles.successHeader}>
          <div className={styles.iconContainer}>
            <div className={styles.confettiTopLeft} />
            <div className={styles.confettiTopRight} />
            <div className={styles.confettiBottomLeft} />
            <div className={styles.confettiBottomRight} />
            <CheckCircleBigIcon />
          </div>
          <h1 className={styles.title}>Fonunuz Başarıyla Oluşturuldu!</h1>
          <p className={styles.subtitle}>
            Taslağınız kaydedildi ve portföy tasarım süreci tamamlandı.
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Portföyünüzün Tahmini Özellikleri
          </h2>

          <div className={styles.grid}>
            {/* 1. Beta */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Beta</h3>
              <p className={styles.featureValue}>
                {areEstimatesLoading || !estimates
                  ? "..."
                  : estimates.beta != null
                    ? estimates.beta.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })
                    : "Veri Yetersiz"}
              </p>
              <p className={styles.featureDesc}>
                Piyasaya göre risk düzeyini gösterir. 1'in üzerindeki değer,
                piyasadan daha dalgalı bir yapı anlamına gelir.
              </p>
            </div>

            {/* 2. Beklenen Volatilite */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>
                Beklenen Volatilite (Yıllık)
              </h3>
              <p className={styles.featureValue}>
                {areEstimatesLoading || !estimates
                  ? "..."
                  : estimates.volatilityPct != null
                    ? `%${estimates.volatilityPct.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}`
                    : "Veri Yetersiz"}
              </p>
              <p className={styles.featureDesc}>
                Portföyünüzün yıllık bazda beklenen dalgalanma oranıdır.
              </p>
            </div>

            {/* 3. Sharpe Oranı */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Sharpe Oranı</h3>
              <p className={styles.featureValue}>
                {areEstimatesLoading || !estimates
                  ? "..."
                  : estimates.sharpeRatio != null
                    ? estimates.sharpeRatio.toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                      })
                    : "Veri Yetersiz"}
              </p>
              <p className={styles.featureDesc}>
                Riske başına elde edilen getiri potansiyelini gösterir. Yüksek
                değer daha iyidir.
              </p>
            </div>

            {/* 4. Maks Drawdown */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Tahmini Maks. Drawdown</h3>
              <p className={styles.featureValue}>
                {areEstimatesLoading || !estimates
                  ? "..."
                  : estimates.maxDrawdownPct != null
                    ? `-%${estimates.maxDrawdownPct.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}`
                    : "Veri Yetersiz"}
              </p>
              <p className={styles.featureDesc}>
                Zor dönemlerde portföyün yaşayabileceği tahmin en büyük değer
                kaybıdır.
              </p>
            </div>
          </div>
        </div>

        <nav className={styles.actions} aria-label="Sonraki adımlar">
          <Link to="/dashboard" className={styles.actionButton}>
            Ana Sayfaya Dön
          </Link>
          <Link to="/fund-monitoring" className={styles.actionButton}>
            Fon İzleme Modülüne Git
          </Link>
          <Link to="/stress-test" className={styles.actionButton}>
            Stres Testi Modülüne Git
          </Link>
        </nav>
      </div>
    </FundDesignLayout>
  )
}
