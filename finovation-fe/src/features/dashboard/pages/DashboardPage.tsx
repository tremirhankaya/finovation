import DashboardHeader from "@/features/dashboard/components/DashboardHeader"
import DashboardSummaryCards from "@/features/dashboard/components/DashboardSummaryCards"
import FundPerformanceOverview from "@/features/dashboard/components/FundPerformanceOverview"
import OptimizationOverview from "@/features/dashboard/components/OptimizationOverview"
import QuickActions from "@/features/dashboard/components/QuickActions"
import RecentFunds from "@/features/dashboard/components/RecentFunds"
import StressTestOverview from "@/features/dashboard/components/StressTestOverview"
import { useDashboard } from "@/features/dashboard/hooks/useDashboard"
import { useAuth } from "@/features/auth/context/AuthContext"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

export default function DashboardPage() {
  const { user } = useAuth()
  const dashboard = useDashboard()
  const latestStressTest = dashboard.stressTests[0]

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <DashboardHeader
          firstName={user?.firstName}
          isRefreshing={dashboard.isOverviewLoading}
          onRefresh={dashboard.reload}
        />

        <DashboardSummaryCards
          fundCount={dashboard.funds.length}
          draftCount={dashboard.drafts.length}
          snapshot={dashboard.monitoringSnapshot}
          optimizationLogs={dashboard.optimizationLogs}
          optimizationResult={dashboard.latestOptimizationResult}
          latestStressTest={latestStressTest}
          errors={dashboard.errors}
          isLoading={dashboard.isOverviewLoading}
        />

        <QuickActions />

        <div className={styles.mainGrid}>
          <FundPerformanceOverview
            funds={dashboard.funds}
            selectedFundId={dashboard.selectedFundId}
            snapshot={dashboard.monitoringSnapshot}
            isLoading={
              dashboard.isOverviewLoading || dashboard.isMonitoringLoading
            }
            errorMessage={dashboard.errors.funds || dashboard.errors.monitoring}
            onFundChange={dashboard.selectFund}
            onRetry={dashboard.reload}
          />
          <StressTestOverview
            test={latestStressTest}
            isLoading={dashboard.isOverviewLoading}
            errorMessage={dashboard.errors.stressTests}
          />
        </div>

        <div className={styles.secondaryGrid}>
          <RecentFunds
            funds={dashboard.funds}
            drafts={dashboard.drafts}
            isLoading={dashboard.isOverviewLoading}
            fundsError={dashboard.errors.funds}
            draftsError={dashboard.errors.drafts}
          />
          <OptimizationOverview
            logs={dashboard.optimizationLogs}
            result={dashboard.latestOptimizationResult}
            isLoading={dashboard.isOverviewLoading}
            errorMessage={dashboard.errors.optimization}
          />
        </div>
      </div>
    </main>
  )
}
