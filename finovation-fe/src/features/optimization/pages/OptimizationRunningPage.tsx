import { useNavigate, useParams } from "react-router"

import OptimizationRunningSteps from "@/features/optimization/components/OptimizationRunningSteps"
import { useOptimizationRun } from "@/features/optimization/hooks/useOptimizationRun"
import type { RiskProfile } from "@/features/optimization/model/optimizationSchemas"
import styles from "@/features/optimization/styles/OptimizationRunningPage.module.css"

const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  AGGRESSIVE: "Atak",
  BALANCED: "Dengeli",
  CONSERVATIVE: "Korumacı",
}

const RISK_PROFILE_TERM_LABELS: Record<RiskProfile, string> = {
  AGGRESSIVE: "3 aylık değerlendirme vadesi",
  BALANCED: "6 aylık değerlendirme vadesi",
  CONSERVATIVE: "12 aylık değerlendirme vadesi",
}

export type OptimizationRunningViewProps = {
  fundId: number | null
  riskProfile: RiskProfile | null
  isRunning: boolean
  isCompleted: boolean
  errorMessage?: string
  onRetry?: () => void
  onBack?: () => void
}

export function OptimizationRunningView({
  fundId,
  riskProfile,
  isRunning,
  isCompleted,
  errorMessage,
  onRetry,
  onBack,
}: OptimizationRunningViewProps) {
  return (
    <main className={styles.page} aria-busy={isRunning}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1>Optimizasyon Çalışıyor</h1>
          <p className={styles.subtitle}>
            {fundId != null ? `Fon #${fundId}` : "Fon"}
            {riskProfile
              ? ` · ${RISK_PROFILE_LABELS[riskProfile]} yaklaşım · ${RISK_PROFILE_TERM_LABELS[riskProfile]}`
              : ""}
          </p>
        </header>

        {isRunning && (
          <div className={styles.loadingBanner} role="status">
            Optimizasyon çalıştırılıyor…
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            <div>
              <strong>Optimizasyon başarısız oldu</strong>
              <span>{errorMessage}</span>
            </div>
            {onRetry && (
              <button type="button" onClick={onRetry} disabled={isRunning}>
                Tekrar Dene
              </button>
            )}
          </div>
        )}

        {isCompleted && (
          <div className={styles.successBanner} role="status">
            <strong>Optimizasyon tamamlandı</strong>
            <span>Sonuç ekranı yakında eklenecek.</span>
          </div>
        )}

        <OptimizationRunningSteps />

        {onBack && (
          <button className={styles.backButton} type="button" onClick={onBack}>
            Panele dön
          </button>
        )}
      </div>
    </main>
  )
}

export default function OptimizationRunningPage() {
  const params = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const requestId = Number(params.requestId)
  const { request, isLoading, errorMessage, retry } =
    useOptimizationRun(requestId)

  return (
    <OptimizationRunningView
      fundId={request?.fundId ?? null}
      riskProfile={request?.riskProfile ?? null}
      isRunning={isLoading}
      isCompleted={request?.status === "COMPLETED"}
      errorMessage={errorMessage || undefined}
      onRetry={retry}
      onBack={() => navigate("/dashboard")}
    />
  )
}
