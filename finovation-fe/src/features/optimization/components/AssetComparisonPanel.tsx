import { useMemo, useState } from "react"

import PortfolioDonutComparison from "@/features/optimization/components/PortfolioDonutComparison"
import {
  buildResultCategories,
  matchesCategory,
  type ResultCategoryKey,
} from "@/features/optimization/lib/optimizationResultCategories"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"
import styles from "@/features/optimization/styles/OptimizationResultPage.module.css"

function formatWeight(value: number): string {
  return `%${Math.round(value)}`
}

function formatChange(value: number): string {
  const rounded = Math.round(value)
  if (rounded > 0) return `+%${rounded}`
  if (rounded < 0) return `-%${Math.abs(rounded)}`
  return "—"
}

const ALL_SECTORS_VALUE = ""

type SortColumn = "currentWeight" | "finalWeight" | "delta"
type SortDirection = "asc" | "desc"

type ComparisonRow = {
  asset: OptimizationResultAsset
  finalWeight: number
  delta: number
}

export type AssetComparisonPanelProps = {
  assets: OptimizationResultAsset[]
  fundName: string
  editable?: boolean
  onFinalWeightChange?: (assetCode: string, value: number) => void
  onResetFinalWeight?: (assetCode: string) => void
}

export default function AssetComparisonPanel({
  assets,
  fundName,
  editable = false,
  onFinalWeightChange,
  onResetFinalWeight,
}: AssetComparisonPanelProps) {
  const [activeCategory, setActiveCategory] = useState<ResultCategoryKey>("ALL")
  const [view, setView] = useState<"table" | "chart">("table")
  const [sectorFilter, setSectorFilter] = useState(ALL_SECTORS_VALUE)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const categories = useMemo(() => buildResultCategories(assets), [assets])

  const sectorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assets
            .map((asset) => asset.sectorName)
            .filter((sectorName): sectorName is string => Boolean(sectorName)),
        ),
      ).sort((a, b) => a.localeCompare(b, "tr-TR")),
    [assets],
  )

  const rows = useMemo<ComparisonRow[]>(() => {
    const filtered = assets
      .filter((asset) => matchesCategory(asset, activeCategory))
      .filter(
        (asset) => !sectorFilter || asset.sectorName === sectorFilter,
      )
      .map((asset) => {
        const finalWeight = asset.finalWeight ?? asset.proposedWeight
        return { asset, finalWeight, delta: finalWeight - asset.currentWeight }
      })

    if (!sortColumn) return filtered

    const directionFactor = sortDirection === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const aValue =
        sortColumn === "currentWeight"
          ? a.asset.currentWeight
          : sortColumn === "finalWeight"
            ? a.finalWeight
            : a.delta
      const bValue =
        sortColumn === "currentWeight"
          ? b.asset.currentWeight
          : sortColumn === "finalWeight"
            ? b.finalWeight
            : b.delta
      return (aValue - bValue) * directionFactor
    })
  }, [assets, activeCategory, sectorFilter, sortColumn, sortDirection])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return (
      <span className={styles.sortIndicator} aria-hidden="true">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    )
  }

  const currentTotal = assets.reduce((sum, asset) => sum + asset.currentWeight, 0)
  const proposedTotal = assets.reduce(
    (sum, asset) => sum + (asset.finalWeight ?? asset.proposedWeight),
    0,
  )

  return (
    <section className={styles.panel}>
      <div className={styles.comparisonHeader}>
        <div>
          <h2 className={styles.panelEyebrow}>
            <span className={styles.panelEyebrowDot} aria-hidden="true" />
            Mevcut vs. Optimize Edilmiş
          </h2>
          <p className={styles.panelDescription}>
            Varlık bazlı dağılım karşılaştırması · {fundName}
          </p>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Görünüm">
          <button
            type="button"
            className={
              view === "table" ? styles.viewToggleButtonActive : styles.viewToggleButton
            }
            onClick={() => setView("table")}
          >
            Tablo
          </button>
          <button
            type="button"
            className={
              view === "chart" ? styles.viewToggleButtonActive : styles.viewToggleButton
            }
            onClick={() => setView("chart")}
          >
            Grafik
          </button>
        </div>
      </div>

      {view === "table" ? (
        <>
          <div className={styles.categoryChips} role="tablist" aria-label="Hisse filtresi">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.key}
                className={
                  activeCategory === category.key
                    ? styles.categoryChipActive
                    : styles.categoryChip
                }
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label} ({category.count})
              </button>
            ))}
          </div>

          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Hisse</th>
                <th>
                  <select
                    className={styles.sectorHeaderFilter}
                    value={sectorFilter}
                    onChange={(event) => setSectorFilter(event.target.value)}
                    aria-label="Sektöre göre filtrele"
                  >
                    <option value={ALL_SECTORS_VALUE}>Sektör</option>
                    {sectorOptions.map((sectorName) => (
                      <option key={sectorName} value={sectorName}>
                        {sectorName}
                      </option>
                    ))}
                  </select>
                </th>
                <th>
                  <button
                    type="button"
                    className={styles.sortableHeaderButton}
                    onClick={() => handleSort("currentWeight")}
                  >
                    Mevcut Ağırlık
                    {sortIndicator("currentWeight")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={styles.sortableHeaderButton}
                    onClick={() => handleSort("finalWeight")}
                  >
                    Optimize Edilmiş
                    {sortIndicator("finalWeight")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={styles.sortableHeaderButton}
                    onClick={() => handleSort("delta")}
                  >
                    Değişim
                    {sortIndicator("delta")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ asset, finalWeight, delta }) => {
                return (
                  <tr key={asset.assetCode}>
                    <td>
                      <span className={styles.assetName}>
                        {asset.assetCode}
                        {asset.actionType === "KEEP" && (
                          <span className={styles.assetLockedBadge}>SABİT</span>
                        )}
                      </span>
                      <span className={styles.assetSector}>{asset.name}</span>
                    </td>
                    <td className={styles.assetSectorCell}>
                      {asset.sectorName ?? "—"}
                    </td>
                    <td>{formatWeight(asset.currentWeight)}</td>
                    <td>
                      {editable ? (
                        <div className={styles.finalWeightCell}>
                          <input
                            type="number"
                            step="0.1"
                            value={finalWeight}
                            onChange={(event) =>
                              onFinalWeightChange?.(
                                asset.assetCode,
                                Number(event.target.value),
                              )
                            }
                            aria-label={`${asset.assetCode} final ağırlığı`}
                          />
                          {asset.manuallyOverridden && (
                            <button
                              type="button"
                              className={styles.resetOverrideButton}
                              onClick={() =>
                                onResetFinalWeight?.(asset.assetCode)
                              }
                            >
                              Manuel · Sıfırla
                            </button>
                          )}
                        </div>
                      ) : (
                        <strong>{formatWeight(finalWeight)}</strong>
                      )}
                    </td>
                    <td
                      className={
                        delta > 0.4
                          ? styles.changePositive
                          : delta < -0.4
                            ? styles.changeNegative
                            : undefined
                      }
                    >
                      {formatChange(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2}>TOPLAM</td>
                <td>{formatWeight(currentTotal)}</td>
                <td>
                  <strong>{formatWeight(proposedTotal)}</strong>
                </td>
                <td
                  className={
                    proposedTotal - currentTotal > 0.4
                      ? styles.changePositive
                      : proposedTotal - currentTotal < -0.4
                        ? styles.changeNegative
                        : undefined
                  }
                >
                  {formatChange(proposedTotal - currentTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      ) : (
        <PortfolioDonutComparison assets={assets} />
      )}
    </section>
  )
}
