import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import AssetComparisonPanel from "@/features/optimization/components/AssetComparisonPanel"
import MetricComplianceSummaryPanel from "@/features/optimization/components/MetricComplianceSummaryPanel"
import OptimizationWizardSteps from "@/features/optimization/components/OptimizationWizardSteps"
import PortfolioCriteriaPanel from "@/features/optimization/components/PortfolioCriteriaPanel"
import { useOptimizationResultReview } from "@/features/optimization/hooks/useOptimizationResultReview"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

export default function OptimizationResultPage() {
  const params = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const requestId = Number(params.requestId)
  const review = useOptimizationResultReview(requestId)
  const fundName = (location.state as { fundName?: string } | null)?.fundName
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  if (review.isLoadingRequest) {
    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.loadingBanner} role="status">
            Optimizasyon isteği yükleniyor…
          </div>
        </div>
      </main>
    )
  }

  if (review.loadErrorMessage) {
    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.errorBanner} role="alert">
            {review.loadErrorMessage}
          </div>
        </div>
      </main>
    )
  }

  if (review.decidedAs) {
    const request = review.request
    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.successPanel} role="status">
            <h1>
              {review.decidedAs === "approve"
                ? "Optimizasyon Onaylandı"
                : "Optimizasyon Reddedildi"}
            </h1>
            <p>
              {review.decidedAs === "approve"
                ? "Önerilen portföy ağırlıkları fon için onaylandı."
                : "Optimizasyon sonucu reddedildi, fon üzerinde bir değişiklik yapılmadı."}
            </p>
            <div className={styles.successActions}>
              {review.decidedAs === "approve" && request && (
                <>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={isExportingPdf}
                    onClick={async () => {
                      setIsExportingPdf(true)
                      try {
                        const { downloadOptimizationResultPdf } = await import(
                          "@/features/optimization/lib/optimizationPdfExport"
                        )
                        await downloadOptimizationResultPdf({
                          fundName: fundName || `Fon #${request.fundId}`,
                          request,
                          assets: review.assets,
                          summary: review.summary,
                          constraintMetrics: review.constraintMetrics,
                          infoMetrics: review.infoMetrics,
                        })
                      } finally {
                        setIsExportingPdf(false)
                      }
                    }}
                  >
                    {isExportingPdf ? "Hazırlanıyor…" : "PDF İndir"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={isExportingExcel}
                    onClick={async () => {
                      setIsExportingExcel(true)
                      try {
                        const { downloadOptimizationResultExcel } =
                          await import(
                            "@/features/optimization/lib/optimizationExcelExport"
                          )
                        await downloadOptimizationResultExcel({
                          fundName: fundName || `Fon #${request.fundId}`,
                          request,
                          assets: review.assets,
                          summary: review.summary,
                          constraintMetrics: review.constraintMetrics,
                          infoMetrics: review.infoMetrics,
                        })
                      } finally {
                        setIsExportingExcel(false)
                      }
                    }}
                  >
                    {isExportingExcel ? "Hazırlanıyor…" : "Excel İndir"}
                  </button>
                </>
              )}
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => navigate("/optimization-requests/new")}
              >
                Yeni Optimizasyon Başlat
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!review.isReviewable) {
    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.errorBanner} role="alert">
            Bu istek henüz onaya hazır değil (durum:{" "}
            {review.request?.status ?? "bilinmiyor"}). Optimizasyonun
            tamamlanmasını bekleyin.
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              navigate(`/optimization-requests/${requestId}/running`)
            }
          >
            ← Çalıştırma Ekranına Dön
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.wizardShell}>
        <header className={styles.header}>
          <h1>Fon Optimizasyonu</h1>
          <p className={styles.subtitle}>
            {fundName || `Fon #${review.request?.fundId}`}
            {" · "}
            {review.reviewStep === 3
              ? "Önerilen portföyü inceleyin, gerekirse ağırlıkları düzenleyin"
              : "Optimizasyon sonucunu onaylayın veya reddedin"}
          </p>
        </header>

        <OptimizationWizardSteps currentStep={review.reviewStep} />

        {review.reviewStep === 3 ? (
          <div className={styles.main}>
            <AssetComparisonPanel
              assets={review.assets}
              onFinalWeightChange={review.setFinalWeight}
              onResetFinalWeight={review.resetFinalWeight}
            />
            <PortfolioCriteriaPanel
              assets={review.assets}
              summary={review.summary}
            />
            <MetricComplianceSummaryPanel
              constraintMetrics={review.constraintMetrics}
              infoMetrics={review.infoMetrics}
            />

            <button
              type="button"
              className={styles.primaryButton}
              onClick={review.goToApproval}
            >
              Onaya İlerle →
            </button>
          </div>
        ) : (
          <div className={styles.main}>
            <section className={styles.panel}>
              <h2 className={styles.panelEyebrow}>
                <span className={styles.panelEyebrowDot} aria-hidden="true" />
                Onay Özeti
              </h2>
              <div className={styles.criteriaSummaryRow}>
                <span>
                  <strong>{review.summary.increasedCount}</strong> hisse
                  artırıldı
                </span>
                <span>
                  <strong>{review.summary.decreasedCount}</strong> hisse
                  azaltıldı
                </span>
                <span>
                  <strong>{review.summary.keptCount}</strong> hisse korundu
                </span>
                <span>
                  <strong>{review.summary.overriddenCount}</strong> hisse manuel
                  değiştirildi
                </span>
              </div>
              <p className={styles.panelDescription}>
                Onayladığınızda önerilen ağırlıklar fon için geçerli olur.
                Reddederseniz fon üzerinde bir değişiklik yapılmaz.
              </p>
            </section>

            {review.isApprovalBlocked && (
              <div className={styles.errorBanner} role="alert">
                Kısıt metriklerinden en az biri kırmızı durumda,
                onaylayamazsınız. Ağırlıkları düzenleyip sonuca dönün.
              </div>
            )}

            {review.submitErrorMessage && (
              <div className={styles.errorBanner} role="alert">
                {review.submitErrorMessage}
              </div>
            )}

            <div className={styles.approvalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={review.goToResult}
                disabled={review.isSubmitting}
              >
                ← Sonuca Dön
              </button>
              <button
                type="button"
                className={styles.rejectButton}
                onClick={() => void review.decide("reject")}
                disabled={review.isSubmitting}
              >
                Reddet
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void review.decide("approve")}
                disabled={review.isSubmitting || review.isApprovalBlocked}
              >
                {review.isSubmitting ? "Gönderiliyor…" : "Onayla"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
