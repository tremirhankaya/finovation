import { useMemo, useState } from "react"

import type { FundPosition } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundHoldingsCardProps = {
  positions: FundPosition[]
}

type SortKey = "asset" | "sector" | "weight"
type SortDirection = "ascending" | "descending"
type SortRule = {
  key: SortKey
  direction: SortDirection
}

const SORT_LABELS: Record<SortKey, string> = {
  asset: "Varlık",
  sector: "Sektör",
  weight: "Ağırlık",
}

const turkishCollator = new Intl.Collator("tr-TR", {
  numeric: true,
  sensitivity: "base",
})

function comparePositions(
  left: FundPosition,
  right: FundPosition,
  key: SortKey,
): number {
  if (key === "weight") {
    return left.weightPercentage - right.weightPercentage
  }

  const leftValue =
    key === "asset"
      ? `${left.symbol} ${left.name}`
      : (left.sectorName ?? "Sınıflandırılmamış")
  const rightValue =
    key === "asset"
      ? `${right.symbol} ${right.name}`
      : (right.sectorName ?? "Sınıflandırılmamış")
  return turkishCollator.compare(leftValue, rightValue)
}

export default function FundHoldingsCard({ positions }: FundHoldingsCardProps) {
  const [sortRules, setSortRules] = useState<SortRule[]>([])
  const largestWeight = Math.max(
    ...positions.map((position) => position.weightPercentage),
    1,
  )
  const sortedPositions = useMemo(
    () =>
      positions
        .map((position, originalIndex) => ({ position, originalIndex }))
        .sort((left, right) => {
          for (const rule of sortRules) {
            const comparison = comparePositions(
              left.position,
              right.position,
              rule.key,
            )
            if (comparison !== 0) {
              return rule.direction === "ascending" ? comparison : -comparison
            }
          }
          return left.originalIndex - right.originalIndex
        })
        .map(({ position }) => position),
    [positions, sortRules],
  )

  const toggleSort = (key: SortKey) => {
    setSortRules((currentRules) => {
      const existingIndex = currentRules.findIndex((rule) => rule.key === key)
      if (existingIndex === -1) {
        return [...currentRules.slice(-1), { key, direction: "ascending" }]
      }

      const existingRule = currentRules[existingIndex]
      if (existingRule.direction === "ascending") {
        return currentRules.map((rule, index) =>
          index === existingIndex
            ? { ...rule, direction: "descending" }
            : rule,
        )
      }
      return currentRules.filter((rule) => rule.key !== key)
    })
  }

  const sortButton = (key: SortKey) => {
    const ruleIndex = sortRules.findIndex((rule) => rule.key === key)
    const rule = ruleIndex === -1 ? null : sortRules[ruleIndex]
    const stateLabel =
      rule === null
        ? "sıralama yok"
        : rule.direction === "ascending"
          ? `artan, öncelik ${ruleIndex + 1}`
          : `azalan, öncelik ${ruleIndex + 1}`

    return (
      <button
        type="button"
        className={styles.holdingsSortButton}
        aria-label={`${SORT_LABELS[key]}: ${stateLabel}`}
        onClick={() => toggleSort(key)}
      >
        <span>{SORT_LABELS[key]}</span>
        <span className={styles.sortDirection} aria-hidden="true">
          {rule === null
            ? "↕"
            : rule.direction === "ascending"
              ? "↑"
              : "↓"}
        </span>
        {rule !== null && (
          <span className={styles.sortPriority} aria-hidden="true">
            {ruleIndex + 1}
          </span>
        )}
      </button>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeadingRow}>
        <h2 className={styles.cardTitle}>Tüm Varlıklar</h2>
        <span>{positions.length} kalem</span>
      </div>

      <div className={styles.holdingsTable} role="table">
        <div className={styles.holdingsHead} role="row">
          <span role="columnheader">{sortButton("asset")}</span>
          <span role="columnheader">{sortButton("sector")}</span>
          <span role="columnheader">{sortButton("weight")}</span>
        </div>

        {positions.length === 0 ? (
          <div className={styles.emptyList} role="row">
            Fon seçildiğinde portföy varlıkları burada listelenecek.
          </div>
        ) : (
          sortedPositions.map((position) => (
            <div
              className={styles.holdingRow}
              role="row"
              key={position.assetId}
            >
              <div role="cell">
                <strong>{position.symbol}</strong>
                <span>{position.name}</span>
                <div className={styles.weightTrack} aria-hidden="true">
                  <div
                    className={styles.weightFill}
                    style={{
                      width: `${(position.weightPercentage / largestWeight) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span role="cell">
                {position.sectorName ?? "Sınıflandırılmamış"}
              </span>
              <strong role="cell">
                %
                {position.weightPercentage.toLocaleString("tr-TR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
