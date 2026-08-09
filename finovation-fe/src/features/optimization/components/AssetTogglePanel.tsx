import { useMemo, useState } from "react"

import type { UniverseAsset } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type AssetTogglePanelProps = {
  title: string
  description: string
  assets: UniverseAsset[]
  selectedAssetCodes: ReadonlySet<string>
  disabledAssetCodes: ReadonlySet<string>
  toggleLabel: string
  variant?: "exclude" | "forceAdd"
  onToggle: (assetCode: string) => void
}

const ALL_SECTORS_VALUE = ""

export default function AssetTogglePanel({
  title,
  description,
  assets,
  selectedAssetCodes,
  disabledAssetCodes,
  toggleLabel,
  variant = "forceAdd",
  onToggle,
}: AssetTogglePanelProps) {
  const [query, setQuery] = useState("")
  const [sectorFilter, setSectorFilter] = useState(ALL_SECTORS_VALUE)

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

  const forceAddOrder = useMemo(
    () => [...selectedAssetCodes],
    [selectedAssetCodes],
  )

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
  const filteredAssets = assets.filter((asset) => {
    if (sectorFilter && asset.sectorName !== sectorFilter) return false
    if (!normalizedQuery) return true
    return [asset.symbol, asset.name, asset.sectorName ?? ""]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery)
  })

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <p className={styles.panelDescription}>{description}</p>

      <input
        type="search"
        className={styles.searchInput}
        placeholder="Hisse veya sektör ara"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={`${title} arama`}
      />

      <select
        className={styles.sectorFilterSelect}
        value={sectorFilter}
        onChange={(event) => setSectorFilter(event.target.value)}
        aria-label={`${title} sektör filtresi`}
      >
        <option value={ALL_SECTORS_VALUE}>Tüm sektörler</option>
        {sectorOptions.map((sectorName) => (
          <option key={sectorName} value={sectorName}>
            {sectorName}
          </option>
        ))}
      </select>

      {filteredAssets.length === 0 ? (
        <p className={styles.emptyState}>
          Aramanızla eşleşen hisse bulunamadı.
        </p>
      ) : (
        <div className={styles.assetTableScroll}>
          <table className={styles.assetTable}>
            <thead>
              <tr>
                <th>Hisse</th>
                {variant === "forceAdd" && <th>Ayrılan Ağırlık</th>}
                <th>{toggleLabel}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.assetCode}>
                  <td>
                    <span className={styles.assetRowSymbol}>
                      {asset.symbol}
                    </span>{" "}
                    <span className={styles.assetRowName}>{asset.name}</span>
                    <div className={styles.fundRowMeta}>
                      {asset.sectorName ?? "—"}
                    </div>
                  </td>
                  {variant === "forceAdd" && (
                    <td className={styles.forceAddWeightCell}>
                      {selectedAssetCodes.has(asset.assetCode)
                        ? `en az %${(forceAddOrder.indexOf(asset.assetCode) + 1) * 3}`
                        : "—"}
                    </td>
                  )}
                  <td>
                    <input
                      type="checkbox"
                      className={
                        variant === "exclude"
                          ? `${styles.assetToggleBox} ${styles.assetToggleBoxExclude}`
                          : `${styles.assetToggleBox} ${styles.assetToggleBoxAdd}`
                      }
                      checked={selectedAssetCodes.has(asset.assetCode)}
                      disabled={disabledAssetCodes.has(asset.assetCode)}
                      onChange={() => onToggle(asset.assetCode)}
                      aria-label={`${asset.symbol} hissesi için ${toggleLabel}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {variant === "forceAdd" && (
        <p className={styles.forceAddHint}>
          Her seçilen hisse için portföyde en az <strong>%3</strong> ağırlık
          ayrılır; seçim sırasına göre toplam ayrılan ağırlık artar (1. hisse
          %3, 2. hisse %6, …) ve bu, kilitli hisselerle birlikte kullanılabilir
          alanı (izahname üst limiti %95) tüketir.
        </p>
      )}
    </section>
  )
}
