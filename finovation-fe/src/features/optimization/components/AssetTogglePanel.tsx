import { useState } from "react"

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

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
  const filteredAssets = normalizedQuery
    ? assets.filter((asset) =>
        [asset.symbol, asset.name, asset.sectorName ?? ""]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(normalizedQuery),
      )
    : assets

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <p className={styles.panelDescription}>{description}</p>

      <input
        type="search"
        className={styles.searchInput}
        placeholder="Hisse, sektör veya kod ara"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={`${title} arama`}
      />

      {filteredAssets.length === 0 ? (
        <p className={styles.emptyState}>
          Aramanızla eşleşen hisse bulunamadı.
        </p>
      ) : (
        <table className={styles.assetTable}>
          <thead>
            <tr>
              <th>Hisse</th>
              <th>Sektör</th>
              <th>{toggleLabel}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.assetCode}>
                <td>
                  {asset.symbol} {asset.name}
                </td>
                <td>{asset.sectorName ?? "—"}</td>
                <td>
                  <input
                    type="checkbox"
                    className={
                      variant === "exclude"
                        ? `${styles.assetCheckbox} ${styles.assetCheckboxExclude}`
                        : styles.assetCheckbox
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
      )}
    </section>
  )
}
