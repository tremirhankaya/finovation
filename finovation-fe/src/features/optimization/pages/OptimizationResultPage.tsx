import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import AssetComparisonPanel from "@/features/optimization/components/AssetComparisonPanel"
import OptimizationWizardSteps from "@/features/optimization/components/OptimizationWizardSteps"
import PortfolioCriteriaScreen from "@/features/optimization/components/PortfolioCriteriaScreen"
import RejectReasonDialog from "@/features/optimization/components/RejectReasonDialog"
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
  const requestId = Number(params.requestId)
  const review = useOptimizationResultReview(requestId)
  const fundName = (location.state as { fundName?: string } | null)?.fundName
  const resolvedFundName = fundName || `Fon #${review.request?.fundId ?? ""}`
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [subView, setSubView] = useState<ResultSubView>("comparison")
  const [isEditingWeights, setIsEditingWeights] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)

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
        criteriaRows: review.criteriaRows,
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
        criteriaRows: review.criteriaRows,
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
    const actorName =
      review.request?.decidedByDisplayName ??
      review.request?.decidedByUsername ??
      "—"
    const decidedAt = review.request?.updatedAt
      ? new Date(review.request.updatedAt)
      : null

    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.celebrationHero} aria-hidden="true">
            <span className={`${styles.confettiDot} ${styles.confettiDotOrange}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotGreen}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotPink}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotCyan}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotBlue}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotMagenta}`} />
            <span className={styles.celebrationCheckNeutral}>✕</span>
          </div>
          <header className={`${styles.header} ${styles.headerCentered}`}>
            <h1>Optimizasyon Reddedildi</h1>
            <p className={styles.subtitle}>
              {resolvedFundName}
              {decidedAt ? ` · ${formatDateTime(decidedAt)}` : ""}
            </p>
            <p className={styles.successLead} role="status">
              Optimizasyon sonucu reddedildi, fon üzerinde bir değişiklik
              yapılmadı.
            </p>
          </header>

          <section className={styles.panel}>
            <h2 className={styles.panelEyebrow}>
              <span className={styles.panelEyebrowDot} aria-hidden="true" />
              İşlem Geçmişine Kaydedildi
            </h2>
            <div className={styles.metricCardGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  İşlemi yapan kullanıcı
                </span>
                <strong className={styles.metricCardValue}>
                  {actorName}
                </strong>
                <p className={styles.metricCardDescription}>
                  Optimizasyonu reddeden kullanıcıdır.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>Tarih ve saat</span>
                <strong className={styles.metricCardValue}>
                  {decidedAt ? formatDateTime(decidedAt) : "—"}
                </strong>
                <p className={styles.metricCardDescription}>
                  Reddin gerçekleştiği tarih ve saattir.
                </p>
              </div>
              {review.request?.rejectionReason && (
                <div className={styles.metricCard}>
                  <span className={styles.metricCardLabel}>
                    Red gerekçesi
                  </span>
                  <p className={styles.metricCardTextValue}>
                    {review.request.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </section>

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
      </main>
    )
  }

  if (review.decidedAs === "approve") {
    const before = equitySnapshot(review.assets, (asset) => asset.currentWeight)
    const proposed = equitySnapshot(
      review.assets,
      (asset) => asset.proposedWeight,
    )
    const final = equitySnapshot(
      review.assets,
      (asset) => asset.finalWeight ?? asset.proposedWeight,
    )
    const actorName =
      review.request?.decidedByDisplayName ??
      review.request?.decidedByUsername ??
      "—"
    const decidedAt = review.request?.updatedAt
      ? new Date(review.request.updatedAt)
      : null

    return (
      <main className={styles.page}>
        <div className={styles.wizardShell}>
          <div className={styles.celebrationHero} aria-hidden="true">
            <span className={`${styles.confettiDot} ${styles.confettiDotOrange}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotGreen}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotPink}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotCyan}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotBlue}`} />
            <span className={`${styles.confettiDot} ${styles.confettiDotMagenta}`} />
            <span className={styles.celebrationCheck}>✓</span>
          </div>
          <header className={`${styles.header} ${styles.headerCentered}`}>
            <h1>Optimizasyon Tamamlandı</h1>
            <p className={styles.subtitle}>
              {resolvedFundName}
              {decidedAt ? ` · ${formatDateTime(decidedAt)}` : ""}
            </p>
            <p className={styles.successLead} role="status">
              Fon portföyünüz başarıyla güncellendi. Onaylanan optimizasyon
              dağılımı mevcut fonunuza uygulanmıştır.
            </p>
          </header>

          <section className={styles.panel}>
            <h2 className={styles.panelEyebrow}>
              <span className={styles.panelEyebrowDot} aria-hidden="true" />
              İşlem Geçmişine Kaydedildi
            </h2>
            <div className={styles.metricCardGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  Optimizasyon öncesi ağırlıklar
                </span>
                <strong className={styles.metricCardValue}>
                  {before.count} hisse · %{before.total.toFixed(0)}
                </strong>
                <p className={styles.metricCardDescription}>
                  Optimizasyon başlamadan önceki portföy dağılımınızdır.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  Modelin önerdiği ağırlıklar
                </span>
                <strong className={styles.metricCardValue}>
                  {proposed.count} hisse · %{proposed.total.toFixed(0)}
                </strong>
                <p className={styles.metricCardDescription}>
                  Model tarafından hesaplanan optimize edilmiş dağılım
                  önerisidir.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  Manuel değişiklik
                </span>
                <strong className={styles.metricCardValue}>
                  {review.summary.overriddenCount > 0
                    ? `${review.summary.overriddenCount} hisse manuel değiştirildi`
                    : "Manuel değişiklik yapılmadı"}
                </strong>
                <p className={styles.metricCardDescription}>
                  Önerilen ağırlıklar üzerinde elle yaptığınız değişiklik
                  sayısıdır.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  Onaylanan nihai ağırlıklar
                </span>
                <strong className={styles.metricCardValue}>
                  {final.count} hisse · %{final.total.toFixed(0)}
                </strong>
                <p className={styles.metricCardDescription}>
                  Onayladığınız ve fonunuza uygulanan son dağılımdır.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>
                  İşlemi yapan kullanıcı
                </span>
                <strong className={styles.metricCardValue}>
                  {actorName}
                </strong>
                <p className={styles.metricCardDescription}>
                  Optimizasyonu onaylayan kullanıcıdır.
                </p>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricCardLabel}>Tarih ve saat</span>
                <strong className={styles.metricCardValue}>
                  {decidedAt ? formatDateTime(decidedAt) : "—"}
                </strong>
                <p className={styles.metricCardDescription}>
                  Onayın gerçekleştiği tarih ve saattir.
                </p>
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
              onResetAllFinalWeights={review.resetAllFinalWeights}
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
            onReject={() => setIsRejectDialogOpen(true)}
          />
        )}
      </div>

      <RejectReasonDialog
        open={isRejectDialogOpen}
        isSubmitting={review.isSubmitting}
        onCancel={() => setIsRejectDialogOpen(false)}
        onConfirm={(reason) => {
          setIsRejectDialogOpen(false)
          void review.decide("reject", reason)
        }}
      />
    </main>
  )
}
