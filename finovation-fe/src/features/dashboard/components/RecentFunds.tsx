import { Link } from "react-router"

import DashboardIcon from "@/features/dashboard/components/DashboardIcon"
import type { FundDraftSummary } from "@/features/fund-design/api/fundDraftApi"
import type { FundOption } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function draftPath(draft: FundDraftSummary): string {
  const segment =
    draft.currentStep === 3
      ? "analysis"
      : draft.currentStep === 4
        ? "alternatives"
        : draft.currentStep === 5
          ? "edit"
          : draft.currentStep === 6
            ? "approve"
            : "strategy"
  return `/fund-design/${draft.draftId}/${segment}`
}

type RecentFundsProps = {
  funds: FundOption[]
  drafts: FundDraftSummary[]
  isLoading: boolean
  fundsError: string
  draftsError: string
}

export default function RecentFunds({
  funds,
  drafts,
  isLoading,
  fundsError,
  draftsError,
}: RecentFundsProps) {
  return (
    <section className={`${styles.panel} ${styles.recentPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <span className={styles.panelEyebrow}>Fon Tasarımı</span>
          <h2>Fonlar ve taslaklar</h2>
        </div>
        <div className={styles.headerLinks}>
          <Link className={styles.headerLink} to="/fund-design">
            Aktif fonlar
          </Link>
          <Link className={styles.headerLink} to="/fund-design?tab=drafts">
            Taslaklar
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.compactLoading} role="status">
          Fonlar yükleniyor…
        </div>
      ) : (
        <div className={styles.recentColumns}>
          <div>
            <div className={styles.listTitle}>
              <span>Aktif Fonlar</span>
              <strong>{funds.length}</strong>
            </div>
            {fundsError ? (
              <p className={styles.inlineError}>{fundsError}</p>
            ) : funds.length === 0 ? (
              <p className={styles.inlineEmpty}>Henüz aktif fon yok.</p>
            ) : (
              <div className={styles.compactList}>
                {funds.slice(0, 3).map((fund) => (
                  <Link
                    to="/fund-design"
                    className={styles.compactRow}
                    key={fund.id}
                  >
                    <span className={`${styles.rowIcon} ${styles.rowIconFund}`}>
                      <DashboardIcon name="fund" />
                    </span>
                    <span className={styles.rowContent}>
                      <strong>{fund.name}</strong>
                      <small>{fund.type}</small>
                    </span>
                    <DashboardIcon name="arrow" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className={styles.listTitle}>
              <span>Devam Eden Taslaklar</span>
              <strong>{drafts.length}</strong>
            </div>
            {draftsError ? (
              <p className={styles.inlineError}>{draftsError}</p>
            ) : drafts.length === 0 ? (
              <p className={styles.inlineEmpty}>Bekleyen taslak yok.</p>
            ) : (
              <div className={styles.compactList}>
                {drafts.slice(0, 3).map((draft) => (
                  <Link
                    to={draftPath(draft)}
                    className={styles.compactRow}
                    key={draft.draftId}
                  >
                    <span
                      className={`${styles.rowIcon} ${styles.rowIconDraft}`}
                    >
                      <DashboardIcon name="draft" />
                    </span>
                    <span className={styles.rowContent}>
                      <strong>{draft.name}</strong>
                      <small>
                        Adım {draft.currentStep ?? 1} ·{" "}
                        {formatDate(draft.updatedAt)}
                      </small>
                    </span>
                    <DashboardIcon name="arrow" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
