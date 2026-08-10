import { useEffect, useMemo, useState } from "react"

import type { OptimizableFund } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type FundSelectionStepProps = {
  funds: OptimizableFund[]
  selectedFundId: string
  onSelectFund: (fundId: string) => void
  onContinue: () => void
  isLoading: boolean
  errorMessage: string
}

type SortDirection = "asc" | "desc" | null

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
    </svg>
  )
}

const PINNED_FUNDS_STORAGE_KEY = "finovation.optimization.pinnedFundIds"

function loadPinnedFundIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PINNED_FUNDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []
  } catch {
    return []
  }
}

function savePinnedFundIds(ids: string[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PINNED_FUNDS_STORAGE_KEY, JSON.stringify(ids))
}

function nextSortDirection(current: SortDirection): SortDirection {
  if (current === null) return "asc"
  if (current === "asc") return "desc"
  return null
}

function sortIndicator(direction: SortDirection): string {
  if (direction === "asc") return "↑"
  if (direction === "desc") return "↓"
  return "↕"
}

export default function FundSelectionStep({
  funds,
  selectedFundId,
  onSelectFund,
  onContinue,
  isLoading,
  errorMessage,
}: FundSelectionStepProps) {
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [pinnedFundIds, setPinnedFundIds] = useState<string[]>(() =>
    loadPinnedFundIds(),
  )

  useEffect(() => {
    savePinnedFundIds(pinnedFundIds)
  }, [pinnedFundIds])

  const togglePinned = (fundId: string) => {
    setPinnedFundIds((current) =>
      current.includes(fundId)
        ? current.filter((id) => id !== fundId)
        : [...current, fundId],
    )
  }

  const sortedFunds = useMemo(() => {
    if (!sortDirection) return funds
    const factor = sortDirection === "asc" ? 1 : -1
    return [...funds].sort((a, b) => {
      const dateA = a.lastOptimizationDateRaw
      const dateB = b.lastOptimizationDateRaw
      if (dateA === dateB) return 0
      if (dateA === null) return -1 * factor
      if (dateB === null) return 1 * factor
      return dateA < dateB ? -1 * factor : 1 * factor
    })
  }, [funds, sortDirection])

  const displayFunds = useMemo(() => {
    const pinned = sortedFunds.filter((fund) => pinnedFundIds.includes(fund.id))
    const rest = sortedFunds.filter((fund) => !pinnedFundIds.includes(fund.id))
    return [...pinned, ...rest]
  }, [sortedFunds, pinnedFundIds])

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelEyebrow}>
        <span className={styles.panelEyebrowDot} aria-hidden="true" />
        Optimize Edilebilir Fonlar
      </h2>

      {isLoading && (
        <div className={styles.loadingBanner} role="status">
          Fonlar yükleniyor…
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && funds.length > 0 && (
        <table className={styles.assetTable}>
          <thead>
            <tr>
              <th aria-hidden="true" />
              <th aria-hidden="true" />
              <th>Fon</th>
              <th>Durum</th>
              <th>
                <button
                  type="button"
                  className={styles.fundSortButton}
                  onClick={() => setSortDirection(nextSortDirection(sortDirection))}
                >
                  Son Optimizasyon
                  <span aria-hidden="true">{sortIndicator(sortDirection)}</span>
                </button>
              </th>
              <th>Hisse / TPP</th>
            </tr>
          </thead>
          <tbody>
            {displayFunds.map((fund) => {
              const isPinned = pinnedFundIds.includes(fund.id)
              return (
                <tr
                  key={fund.id}
                  className={isPinned ? styles.fundRowPinned : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className={
                        isPinned
                          ? styles.fundPinButtonActive
                          : styles.fundPinButton
                      }
                      onClick={() => togglePinned(fund.id)}
                      aria-pressed={isPinned}
                      aria-label={
                        isPinned
                          ? `${fund.name} fonunu üstten kaldır`
                          : `${fund.name} fonunu üste sabitle`
                      }
                    >
                      <PinIcon />
                    </button>
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="optimization-fund"
                      className={styles.assetCheckbox}
                      checked={selectedFundId === fund.id}
                      onChange={() => onSelectFund(fund.id)}
                      aria-label={`${fund.name} fonunu seç`}
                    />
                  </td>
                  <td>
                    <span className={styles.fundRowName}>{fund.name}</span>
                    <div className={styles.fundRowMeta}>
                      {fund.stockCount} hisse · {fund.sectorCount} sektör
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        fund.active
                          ? styles.fundStatusBadgeActive
                          : styles.fundStatusBadge
                      }
                    >
                      {fund.active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td>
                    {fund.lastOptimizationDate ?? "Optimizasyon yapılmadı"}
                  </td>
                  <td>
                    <div className={styles.fundWeightLabels}>
                      <span>Hisse %{fund.equityWeightPercent}</span>
                      <span>TPP %{fund.tppWeightPercent}</span>
                    </div>
                    <div
                      className={styles.fundWeightBarTrack}
                      role="img"
                      aria-label={`Hisse yüzde ${fund.equityWeightPercent}, TPP yüzde ${fund.tppWeightPercent}`}
                    >
                      <div
                        className={styles.fundWeightBarFill}
                        style={{ width: `${fund.equityWeightPercent}%` }}
                      />
                      <div
                        className={styles.fundWeightBarFillTpp}
                        style={{ width: `${fund.tppWeightPercent}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className={styles.fundSelectionFooter}>
        <button
          type="button"
          className={styles.submitButton}
          disabled={!selectedFundId}
          onClick={onContinue}
        >
          Optimizasyona Başla
        </button>
        <span className={styles.fundSelectionHint}>
          Yalnızca tek fon varsa fon otomatik seçilir.
        </span>
      </div>
    </section>
  )
}
