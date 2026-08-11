import { useEffect, useMemo, useState } from "react"

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

const TOTAL_WEIGHT_TARGET = 100
const TOTAL_WEIGHT_TOLERANCE = 0.5

const ALL_SECTORS_VALUE = ""

type SortColumn = "currentWeight" | "finalWeight" | "delta"
type SortDirection = "asc" | "desc"

type ComparisonRow = {
  asset: OptimizationResultAsset
  finalWeight: number
  delta: number
}

type EditableFinalWeightCellProps = {
  assetCode: string
  finalWeight: number
  manuallyOverridden: boolean
  onFinalWeightChange?: (assetCode: string, value: number) => void
  onResetFinalWeight?: (assetCode: string) => void
}

function EditableFinalWeightCell({
  assetCode,
  finalWeight,
  manuallyOverridden,
  onFinalWeightChange,
  onResetFinalWeight,
}: EditableFinalWeightCellProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [draft, setDraft] = useState(() => finalWeight.toFixed(1))

  useEffect(() => {
    if (!isFocused) setDraft(finalWeight.toFixed(1))
  }, [finalWeight, isFocused])

  return (
    <div className={styles.finalWeightCell}>
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        value={draft}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          setDraft(event.target.value)
          const parsed = Number(event.target.value)
          if (!Number.isNaN(parsed)) {
            onFinalWeightChange?.(assetCode, parsed)
          }
        }}
        onBlur={() => {
          setIsFocused(false)
          setDraft(finalWeight.toFixed(1))
        }}
        aria-label={`${assetCode} final ağırlığı`}
      />
      {manuallyOverridden && (
        <button
          type="button"
          className={styles.resetOverrideButton}
          onClick={() => onResetFinalWeight?.(assetCode)}
        >
          Manuel · Sıfırla
        </button>
      )}
    </div>
  )
}

export type AssetComparisonPanelProps = {
  assets: OptimizationResultAsset[]
  fundName: string
  editable?: boolean
  onFinalWeightChange?: (assetCode: string, value: number) => void
  onResetFinalWeight?: (assetCode: string) => void
  onResetAllFinalWeights?: () => void
}

export default function AssetComparisonPanel({
  assets,
  fundName,
  editable = false,
  onFinalWeightChange,
  onResetFinalWeight,
  onResetAllFinalWeights,
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
        return {
          asset,
          finalWeight,
          delta: Math.round(finalWeight) - Math.round(asset.currentWeight),
        }
      })

    const sorted = sortColumn
      ? [...filtered].sort((a, b) => {
          const directionFactor = sortDirection === "asc" ? 1 : -1
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
      : filtered

    const equities = sorted.filter((row) => row.asset.assetType !== "TPP")
    const tpp = sorted.filter((row) => row.asset.assetType === "TPP")
    return [...equities, ...tpp]
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
  const proposedTotalValid =
    Math.abs(proposedTotal - TOTAL_WEIGHT_TARGET) <= TOTAL_WEIGHT_TOLERANCE
  const hasManualOverrides = assets.some((asset) => asset.manuallyOverridden)

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
        <div className={styles.comparisonHeaderActions}>
          {editable && hasManualOverrides && (
            <button
              type="button"
              className={styles.resetAllOverridesButton}
              onClick={onResetAllFinalWeights}
            >
              Tümünü Sıfırla
            </button>
          )}
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
                <th>Varlık</th>
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
                        {asset.userLocked && (
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
                        <EditableFinalWeightCell
                          assetCode={asset.assetCode}
                          finalWeight={finalWeight}
                          manuallyOverridden={asset.manuallyOverridden}
                          onFinalWeightChange={onFinalWeightChange}
                          onResetFinalWeight={onResetFinalWeight}
                        />
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
                  <strong
                    className={
                      editable && !proposedTotalValid
                        ? styles.totalWeightInvalid
                        : undefined
                    }
                  >
                    {formatWeight(proposedTotal)}
                  </strong>
                  {editable && !proposedTotalValid && (
                    <span className={styles.totalWeightWarning}>
                      Toplam %100 olmalı
                    </span>
                  )}
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
