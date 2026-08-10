import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import { useAuth } from "@/features/auth/context/AuthContext"
import AssetComparisonPanel from "@/features/optimization/components/AssetComparisonPanel"
import OptimizationWizardSteps from "@/features/optimization/components/OptimizationWizardSteps"
import PortfolioCriteriaScreen from "@/features/optimization/components/PortfolioCriteriaScreen"
import { useOptimizationResultReview } from "@/features/optimization/hooks/useOptimizationResultReview"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

function equitySnapshot(
  assets: OptimizationResultAsset[],
  pickWeight: (asset: OptimizationResultAsset) => number,
) {
  const held = assets.filter(
    (asset) => asset.assetType === "EQUITY" && pickWeight(asset) > 0.001,
  )
  return {
    count: held.length,
    total: held.reduce((sum, asset) => sum + pickWeight(asset), 0),
  }
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type ResultSubView = "comparison" | "criteria"

export default function OptimizationResultPage() {
  const params = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const requestId = Number(params.requestId)
  const review = useOptimizationResultReview(requestId)
  const fundName = (location.state as { fundName?: string } | null)?.fundName
  const resolvedFundName = fundName || `Fon #${review.request?.fundId ?? ""}`
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [subView, setSubView] = useState<ResultSubView>("comparison")
  const [isEditingWeights, setIsEditingWeights] = useState(false)

  const exportPdf = async () => {
    if (!review.request) return
    setIsExportingPdf(true)
    try {
      const { downloadOptimizationResultPdf } = await import(
        "@/features/optimization/lib/optimizationPdfExport"
      )
      await downloadOptimizationResultPdf({
        fundName: resolvedFundName,
        request: review.request,
        assets: review.assets,
        summary: review.summary,
        constraintMetrics: review.constraintMetrics,
        infoMetrics: review.infoMetrics,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  const exportExcel = async () => {
    if (!review.request) return
    setIsExportingExcel(true)
    try {
      const { downloadOptimizationResultExcel } = await import(
        "@/features/optimization/lib/optimizationExcelExport"
      )
      await downloadOptimizationResultExcel({
        fundName: resolvedFundName,
        request: review.request,
        assets: review.assets,
        summary: review.summary,
        constraintMetrics: review.constraintMetrics,
        infoMetrics: review.infoMetrics,
      })
    } finally {
      setIsExportingExcel(false)
    }
  }

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

  if (review.decidedAs === "reject") {
    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.successPanel} role="status">
            <h1>Optimizasyon Reddedildi</h1>
            <p className={styles.subtitle}>{resolvedFundName}</p>
            <p>
              Optimizasyon sonucu reddedildi, fon üzerinde bir değişiklik
              yapılmadı.
            </p>
            <div className={styles.successActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => navigate("/optimization-requests/new")}
              >
                Yeni Optimizasyon
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (review.decidedAs === "approve") {
    const decidedAt = new Date(review.request?.updatedAt ?? "")
    const before = equitySnapshot(review.assets, (asset) => asset.currentWeight)
    const proposed = equitySnapshot(
      review.assets,
      (asset) => asset.proposedWeight,
    )
    const final = equitySnapshot(
      review.assets,
      (asset) => asset.finalWeight ?? asset.proposedWeight,
    )
    const actorName = user ? `${user.firstName} ${user.lastName}` : "—"

    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <header className={styles.header}>
            <h1>Optimizasyon Tamamlandı</h1>
            <p className={styles.subtitle}>
              {resolvedFundName} · {formatDateTime(decidedAt)}
            </p>
          </header>

          <div className={styles.successBanner} role="status">
            <span className={styles.successBannerIcon} aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>Fon portföyü başarıyla güncellendi.</strong>
              <p>
                Onaylanan optimizasyon dağılımı mevcut fonunuza
                uygulanmıştır.
              </p>
            </div>
          </div>

          <section className={styles.panel}>
            <h2 className={styles.panelEyebrow}>
              <span className={styles.panelEyebrowDot} aria-hidden="true" />
              İşlem Geçmişine Kaydedildi
            </h2>
            <div className={styles.successInfoGrid}>
              <div className={styles.successInfoItem}>
                <span>Optimizasyon öncesi ağırlıklar</span>
                <strong>
                  {before.count} hisse · %{before.total.toFixed(0)}
                </strong>
              </div>
              <div className={styles.successInfoItem}>
                <span>Modelin önerdiği ağırlıklar</span>
                <strong>
                  {proposed.count} hisse · %{proposed.total.toFixed(0)}
                </strong>
              </div>
              <div className={styles.successInfoItem}>
                <span>Manuel değişiklik</span>
                <strong>
                  {review.summary.overriddenCount > 0
                    ? `${review.summary.overriddenCount} hisse manuel değiştirildi`
                    : "Manuel değişiklik yapılmadı"}
                </strong>
              </div>
              <div className={styles.successInfoItem}>
                <span>Onaylanan nihai ağırlıklar</span>
                <strong>
                  {final.count} hisse · %{final.total.toFixed(0)}
                </strong>
              </div>
              <div className={styles.successInfoItem}>
                <span>İşlemi yapan kullanıcı</span>
                <strong>{actorName}</strong>
              </div>
              <div className={styles.successInfoItem}>
                <span>Tarih ve saat</span>
                <strong>{formatDateTime(decidedAt)}</strong>
              </div>
            </div>
            <p className={styles.successNote}>
              Yeni portföy versiyonu oluşturulmaz; mevcut fon doğrudan
              güncellenir. Bu kayıt yalnızca denetim ve raporlama amacıyla
              saklanır.
            </p>
          </section>

          <div className={styles.successActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => navigate("/fund-monitoring")}
            >
              Fon İzlemeye Git
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate("/optimization-requests/logs")}
            >
              İşlem Loglarını Gör
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigate("/optimization-requests/new")}
            >
              Yeni Optimizasyon
            </button>
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
          <h1>Optimizasyon Sonucu</h1>
          <p className={styles.subtitle}>
            Varlık bazlı dağılım karşılaştırması · {resolvedFundName}
          </p>
        </header>

        <OptimizationWizardSteps currentStep={3} />

        {subView === "comparison" ? (
          <div className={styles.main}>
            <AssetComparisonPanel
              assets={review.assets}
              fundName={resolvedFundName}
              editable={isEditingWeights}
              onFinalWeightChange={review.setFinalWeight}
              onResetFinalWeight={review.resetFinalWeight}
            />

            <div className={styles.criteriaActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setSubView("criteria")}
              >
                Portföy Kriterlerini Gör
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => navigate("/optimization-requests/new")}
              >
                Tercihleri Değiştir
              </button>
            </div>
          </div>
        ) : (
          <PortfolioCriteriaScreen
            fundName={resolvedFundName}
            rows={review.criteriaRows}
            rationaleAssets={review.assets.filter((asset) => asset.rationale)}
            isApprovalBlocked={review.isApprovalBlocked}
            isSubmitting={review.isSubmitting}
            submitErrorMessage={review.submitErrorMessage}
            onExportPdf={exportPdf}
            isExportingPdf={isExportingPdf}
            onExportExcel={exportExcel}
            isExportingExcel={isExportingExcel}
            onEditWeights={() => {
              setIsEditingWeights(true)
              setSubView("comparison")
            }}
            onApprove={() => void review.decide("approve")}
            onReject={() => void review.decide("reject")}
          />
        )}
      </div>
    </main>
  )
}
