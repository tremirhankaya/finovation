import { useMemo, useState } from "react"

import type { UniverseAsset } from "@/features/optimization/model/optimizationForm.types"
import styles from "@/features/optimization/styles/OptimizationFormPage.module.css"

export type PinnedAsset = {
  assetId: string
  symbol: string
  name: string
  sectorName: string | null
}

export type AssetTogglePanelProps = {
  title: string
  description: string
  assets: UniverseAsset[]
  selectedAssetCodes: ReadonlySet<string>
  disabledAssetCodes: ReadonlySet<string>
  disabledTitle?: string
  toggleLabel: string
  variant?: "exclude" | "forceAdd"
  onToggle: (assetCode: string) => void
  pinnedAssets?: PinnedAsset[]
  pinnedBadgeLabel?: string
  onTogglePinned?: (assetId: string) => void
}

const ALL_SECTORS_VALUE = ""

export default function AssetTogglePanel({
  title,
  description,
  assets,
  selectedAssetCodes,
  disabledAssetCodes,
  disabledTitle,
  toggleLabel,
  variant = "forceAdd",
  onToggle,
  pinnedAssets = [],
  pinnedBadgeLabel,
  onTogglePinned,
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

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
  const filteredAssets = assets
    .filter((asset) => {
      if (sectorFilter && asset.sectorName !== sectorFilter) return false
      if (!normalizedQuery) return true
      return [asset.symbol, asset.name, asset.sectorName ?? ""]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery)
    })
    .sort((a, b) => {
      const aSelected = selectedAssetCodes.has(a.assetCode) ? 0 : 1
      const bSelected = selectedAssetCodes.has(b.assetCode) ? 0 : 1
      return aSelected - bSelected
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

      {filteredAssets.length === 0 && pinnedAssets.length === 0 ? (
        <p className={styles.emptyState}>
          Aramanızla eşleşen hisse bulunamadı.
        </p>
      ) : (
        <div className={styles.assetTableScroll}>
          <table className={styles.assetTable}>
            <thead>
              <tr>
                <th>Hisse</th>
                <th>{toggleLabel}</th>
              </tr>
            </thead>
            <tbody>
              {pinnedAssets.map((pinned) => (
                <tr key={`pinned-${pinned.assetId}`} className={styles.pinnedAssetRow}>
                  <td>
                    <span className={styles.assetRowSymbol}>
                      {pinned.symbol}
                    </span>{" "}
                    <span className={styles.assetRowName}>{pinned.name}</span>
                    {pinnedBadgeLabel && (
                      <span className={styles.pinnedBadge}>
                        {pinnedBadgeLabel}
                      </span>
                    )}
                    <div className={styles.fundRowMeta}>
                      {pinned.sectorName ?? "—"}
                    </div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className={`${styles.assetToggleBox} ${styles.assetToggleBoxExclude}`}
                      checked
                      onChange={() => onTogglePinned?.(pinned.assetId)}
                      aria-label={`${pinned.symbol} hissesi için ${toggleLabel} (B panelinden)`}
                    />
                  </td>
                </tr>
              ))}
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
                      title={
                        disabledAssetCodes.has(asset.assetCode)
                          ? disabledTitle
                          : undefined
                      }
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
    </section>
  )
}
