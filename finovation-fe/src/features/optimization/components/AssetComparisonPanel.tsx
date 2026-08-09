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

  const categories = useMemo(() => buildResultCategories(assets), [assets])
  const visibleAssets = useMemo(
    () => assets.filter((asset) => matchesCategory(asset, activeCategory)),
    [assets, activeCategory],
  )

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
                <th>Sektör</th>
                <th>Mevcut Ağırlık</th>
                <th>Optimize Edilmiş</th>
                <th>Değişim</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((asset) => {
                const finalWeight = asset.finalWeight ?? asset.proposedWeight
                const delta = finalWeight - asset.currentWeight

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
