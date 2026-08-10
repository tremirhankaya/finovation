import DashboardIcon, {
  type DashboardIconName,
} from "@/features/dashboard/components/DashboardIcon"
import { formatPercentage } from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import type { FundMonitoringSnapshot } from "@/features/fund-monitoring/model/fundMonitoring.types"
import { REQUEST_STATUS_LABELS } from "@/features/optimization/lib/optimizationExportLabels"
import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import type { OptimizationResult } from "@/features/optimization/model/optimizationResultSchemas"
import type { OptimizationLogEntry } from "@/features/optimization/model/optimizationSchemas"
import { formatStressPercentage } from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestHistoryResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

const metricFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type SummaryCard = {
  label: string
  value: string
  detail: string
  icon: DashboardIconName
  tone?: "positive" | "negative" | "neutral"
}

function OptimizationCardValue({
  result,
  log,
}: {
  result: OptimizationResult | null
  log?: OptimizationLogEntry
}): Pick<SummaryCard, "value" | "detail"> {
  if (result) {
    const { proposed } = buildRiskMetricsSnapshots(result.metrics)
    return {
      value:
        proposed.volatility === null
          ? "Sonuç hazır"
          : `%${metricFormatter.format(proposed.volatility)}`,
      detail:
        proposed.volatility === null
          ? (log?.fundName ?? "Optimizasyon tamamlandı")
          : `Önerilen volatilite · ${log?.fundName ?? "Son sonuç"}`,
    }
  }

  return {
    value: log ? (REQUEST_STATUS_LABELS[log.status] ?? log.status) : "—",
    detail: log?.fundName ?? "Henüz optimizasyon yok",
  }
}

type DashboardSummaryCardsProps = {
  fundCount: number
  draftCount: number
  snapshot: FundMonitoringSnapshot | null
  optimizationLogs: OptimizationLogEntry[]
  optimizationResult: OptimizationResult | null
  latestStressTest?: StressTestHistoryResponse
  isLoading: boolean
}

export default function DashboardSummaryCards({
  fundCount,
  draftCount,
  snapshot,
  optimizationLogs,
  optimizationResult,
  latestStressTest,
  isLoading,
}: DashboardSummaryCardsProps) {
  const oneMonthReturn = snapshot?.periodReturns.find(
    (item) => item.period === "1M",
  )?.value
  const optimizationLog = optimizationLogs.find((log) => log.resultAvailable)
  const optimization = OptimizationCardValue({
    result: optimizationResult,
    log: optimizationLog ?? optimizationLogs[0],
  })

  const cards: SummaryCard[] = [
    {
      label: "Aktif Fonlar",
      value: isLoading ? "—" : String(fundCount),
      detail:
        fundCount > 0 ? "İzlenen ve işlem yapılabilir" : "Henüz aktif fon yok",
      icon: "fund",
    },
    {
      label: "Devam Eden Taslaklar",
      value: isLoading ? "—" : String(draftCount),
      detail:
        draftCount > 0 ? "Tasarımı bekleyen fonlar" : "Bekleyen taslak yok",
      icon: "draft",
    },
    {
      label: "1 Aylık Getiri",
      value:
        isLoading || oneMonthReturn === undefined
          ? "—"
          : formatPercentage(oneMonthReturn),
      detail: snapshot?.fund.name ?? "Aktif fon seçilmedi",
      icon: "performance",
      tone:
        oneMonthReturn == null
          ? "neutral"
          : oneMonthReturn >= 0
            ? "positive"
            : "negative",
    },
    {
      label: "Son Optimizasyon",
      value: isLoading ? "—" : optimization.value,
      detail: isLoading ? "Veriler yükleniyor" : optimization.detail,
      icon: "optimization",
    },
    {
      label: "Son Stres Etkisi",
      value:
        isLoading || !latestStressTest
          ? "—"
          : formatStressPercentage(latestStressTest.portfolioImpact),
      detail: latestStressTest?.scenarioName ?? "Henüz stres testi yok",
      icon: "stress",
      tone:
        !latestStressTest || latestStressTest.portfolioImpact === 0
          ? "neutral"
          : latestStressTest.portfolioImpact > 0
            ? "positive"
            : "negative",
    },
  ]

  return (
    <section className={styles.summaryGrid} aria-label="Genel özet">
      {cards.map((card) => (
        <article className={styles.summaryCard} key={card.label}>
          <div className={styles.summaryCardTop}>
            <span className={styles.summaryLabel}>{card.label}</span>
            <span className={styles.summaryIcon}>
              <DashboardIcon name={card.icon} />
            </span>
          </div>
          <strong
            className={`${styles.summaryValue} ${
              card.tone ? styles[`summaryValue${card.tone}`] : ""
            }`}
          >
            {card.value}
          </strong>
          <span className={styles.summaryDetail}>{card.detail}</span>
        </article>
      ))}
    </section>
  )
}
