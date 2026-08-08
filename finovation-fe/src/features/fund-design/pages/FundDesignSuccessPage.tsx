import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import { getFundEstimates, type FundEstimates } from "@/features/fund-design/api/fundDraftApi"
import styles from "@/features/fund-design/styles/FundDesignSuccessPage.module.css"
import Button from "@/shared/ui/Button"

const CheckCircleBigIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="32" fill="#059669"/>
    <path d="M19 32L28 41L45 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function FundDesignSuccessPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const [estimates, setEstimates] = useState<FundEstimates | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!draftId) return
    let active = true
    getFundEstimates(draftId)
      .then((res) => {
        if (active) {
          setEstimates(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error("Failed to load estimates", err)
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [draftId])

  return (
    <FundDesignLayout step={7} wide>
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
          <h2 className={styles.cardTitle}>Portföyünüzün Tahmini Özellikleri</h2>
          
          <div className={styles.grid}>
            {/* 1. Beta */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Beta</h3>
              <p className={styles.featureValue}>
                {isLoading || !estimates ? "..." : (estimates.beta != null ? estimates.beta.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "Veri Yetersiz")}
              </p>
              <p className={styles.featureDesc}>
                Piyasaya göre risk düzeyini gösterir. 1'in üzerindeki değer, piyasadan daha dalgalı bir yapı anlamına gelir.
              </p>
            </div>

            {/* 2. Beklenen Volatilite */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Beklenen Volatilite (Yıllık)</h3>
              <p className={styles.featureValue}>
                {isLoading || !estimates ? "..." : (estimates.volatilityPct != null ? `%${estimates.volatilityPct.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}` : "Veri Yetersiz")}
              </p>
              <p className={styles.featureDesc}>
                Portföyünüzün yıllık bazda beklenen dalgalanma oranıdır.
              </p>
            </div>

            {/* 3. Sharpe Oranı */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Sharpe Oranı</h3>
              <p className={styles.featureValue}>
                {isLoading || !estimates ? "..." : (estimates.sharpeRatio != null ? estimates.sharpeRatio.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "Veri Yetersiz")}
              </p>
              <p className={styles.featureDesc}>
                Riske başına elde edilen getiri potansiyelini gösterir. Yüksek değer daha iyidir.
              </p>
            </div>

            {/* 4. Maks Drawdown */}
            <div className={styles.featureBox}>
              <h3 className={styles.featureLabel}>Tahmini Maks. Drawdown</h3>
              <p className={styles.featureValue}>
                {isLoading || !estimates ? "..." : (estimates.maxDrawdownPct != null ? `-%${estimates.maxDrawdownPct.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}` : "Veri Yetersiz")}
              </p>
              <p className={styles.featureDesc}>
                Zor dönemlerde portföyün yaşayabileceği tahmin en büyük değer kaybıdır.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link to="/" className={styles.linkButton}>Taslaklarıma Git</Link>
          <Button onClick={() => navigate("/fund-design/start")} variant="primary" type="button">
            Yeni Fon Oluştur
          </Button>
        </div>
      </div>
    </FundDesignLayout>
  )
}
