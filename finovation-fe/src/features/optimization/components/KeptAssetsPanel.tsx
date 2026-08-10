import { useMemo, useState } from "react"

import type { FundPosition } from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type KeptAssetsPanelProps = {
  positions: FundPosition[]
  keptAssetCodes: ReadonlySet<string>
  excludedAssetIds: ReadonlySet<string>
  keptWeightSum: number
  keepAtLimit: boolean
  excludeAtLimit: boolean
  onToggle: (assetCode: string) => void
  onToggleExclude: (assetId: string) => void
}

const ALL_SECTORS_VALUE = ""
const TPP_ASSET_SYMBOL = "TPP1G"

export default function KeptAssetsPanel({
  positions,
  keptAssetCodes,
  excludedAssetIds,
  keptWeightSum,
  keepAtLimit,
  excludeAtLimit,
  onToggle,
  onToggleExclude,
}: KeptAssetsPanelProps) {
  const [query, setQuery] = useState("")
  const [sectorFilter, setSectorFilter] = useState(ALL_SECTORS_VALUE)

  const stockPositions = useMemo(
    () => positions.filter((position) => position.symbol !== TPP_ASSET_SYMBOL),
    [positions],
  )

  const sectorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          stockPositions
            .map((position) => position.sectorName)
            .filter((sectorName): sectorName is string => Boolean(sectorName)),
        ),
      ).sort((a, b) => a.localeCompare(b, "tr-TR")),
    [stockPositions],
  )

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
  const filteredPositions = stockPositions.filter((position) => {
    if (sectorFilter && position.sectorName !== sectorFilter) return false
    if (!normalizedQuery) return true
    return [position.symbol, position.name, position.sectorName ?? ""]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery)
  })

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        B · Optimizasyonda Korunacak Hisseler
      </h2>
      <p className={styles.panelDescription}>
        {keptAssetCodes.size} hisse sabitlendi · toplam %
        {keptWeightSum.toFixed(0)}. İşaretlenen hisse portföyde kalır ve mevcut
        ağırlığı sabit tutulur. En fazla 3 hisse korunabilir, en fazla 3 hisse
        çıkarılabilir.
      </p>

      {stockPositions.length > 0 && (
        <>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Hisse veya sektör ara"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Optimizasyonda korunacak hisseler arama"
          />

          <select
            className={styles.sectorFilterSelect}
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            aria-label="Optimizasyonda korunacak hisseler sektör filtresi"
          >
            <option value={ALL_SECTORS_VALUE}>Tüm sektörler</option>
            {sectorOptions.map((sectorName) => (
              <option key={sectorName} value={sectorName}>
                {sectorName}
              </option>
            ))}
          </select>
        </>
      )}

      {stockPositions.length === 0 ? (
        <p className={styles.emptyState}>
          Fonun mevcut pozisyon verisi bulunamadı.
        </p>
      ) : filteredPositions.length === 0 ? (
        <p className={styles.emptyState}>
          Aramanızla eşleşen hisse bulunamadı.
        </p>
      ) : (
        <div className={styles.assetTableScroll}>
          <table className={styles.assetTable}>
            <thead>
              <tr>
                <th>Hisse</th>
                <th>Mevcut Ağırlık</th>
                <th>Koru</th>
                <th>Çıkar</th>
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((position) => (
                <tr key={position.assetId}>
                  <td>
                    <span className={styles.assetRowSymbol}>
                      {position.symbol}
                    </span>{" "}
                    <span className={styles.assetRowName}>
                      {position.name}
                    </span>
                    <div className={styles.fundRowMeta}>
                      {position.sectorName ?? "—"}
                    </div>
                  </td>
                  <td>%{position.weightPercentage}</td>
                  <td>
                    <input
                      type="checkbox"
                      className={`${styles.assetToggleBox} ${styles.assetToggleBoxAdd}`}
                      checked={keptAssetCodes.has(position.assetId)}
                      disabled={
                        keepAtLimit && !keptAssetCodes.has(position.assetId)
                      }
                      title={
                        keepAtLimit && !keptAssetCodes.has(position.assetId)
                          ? "En fazla 3 hisse korunabilir"
                          : undefined
                      }
                      onChange={() => onToggle(position.assetId)}
                      aria-label={`${position.symbol} hissesini koru`}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className={`${styles.assetToggleBox} ${styles.assetToggleBoxExclude}`}
                      checked={excludedAssetIds.has(position.assetId)}
                      disabled={
                        excludeAtLimit && !excludedAssetIds.has(position.assetId)
                      }
                      title={
                        excludeAtLimit && !excludedAssetIds.has(position.assetId)
                          ? "En fazla 3 hisse çıkarılabilir"
                          : undefined
                      }
                      onChange={() => onToggleExclude(position.assetId)}
                      aria-label={`${position.symbol} hissesini çıkar`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
