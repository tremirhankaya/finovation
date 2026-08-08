import { useMemo, useState } from "react"

import type { ModelUniverseAsset } from "@/features/fund-design/model/fundDraftSchemas"
import styles from "@/features/fund-design/styles/AssetPreferencePicker.module.css"
import Dialog from "@/shared/ui/Dialog"

type Props = {
  forcedCodes: string[]
  excludedCodes: string[]
  minStockCount: number
  maxAssetPreferences: number
  universe: ModelUniverseAsset[]
  disabled?: boolean
  onForcedChange: (codes: string[]) => void
  onExcludedChange: (codes: string[]) => void
}

type UniverseStatus = "idle" | "ready"

function labelFor(universe: ModelUniverseAsset[], code: string): string {
  const hit = universe.find((item) => item.assetCode === code)
  return hit?.displayName && hit.displayName !== code
    ? `${code} · ${hit.displayName}`
    : code
}

function ActionButtons({
  code,
  isForced,
  isExcluded,
  disabled,
  forceLimitReached,
  excludeLimitReached,
  forcedLimit,
  excludedLimit,
  onAddForced,
  onRemoveForced,
  onAddExcluded,
  onRemoveExcluded,
}: {
  code: string
  isForced: boolean
  isExcluded: boolean
  disabled: boolean
  forceLimitReached: boolean
  excludeLimitReached: boolean
  forcedLimit: number
  excludedLimit: number
  onAddForced: (code: string) => void
  onRemoveForced: (code: string) => void
  onAddExcluded: (code: string) => void
  onRemoveExcluded: (code: string) => void
}) {
  return (
    <div className={styles.resultActions}>
      <button
        type="button"
        className={[styles.forceBtn, isForced ? styles.forceBtnActive : ""]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled || (!isForced && forceLimitReached)}
        title={
          !isForced && forceLimitReached
            ? `En fazla ${forcedLimit} zorunlu hisse`
            : "Zorunlu ekle"
        }
        onClick={() => (isForced ? onRemoveForced(code) : onAddForced(code))}
      >
        Zorunlu
      </button>
      <button
        type="button"
        className={[
          styles.excludeBtn,
          isExcluded ? styles.excludeBtnActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled || (!isExcluded && excludeLimitReached)}
        title={
          !isExcluded && excludeLimitReached
            ? `En fazla ${excludedLimit} hariç hisse`
            : "Hariç tut"
        }
        onClick={() =>
          isExcluded ? onRemoveExcluded(code) : onAddExcluded(code)
        }
      >
        Hariç
      </button>
    </div>
  )
}

export default function AssetPreferencePicker({
  forcedCodes,
  excludedCodes,
  minStockCount,
  maxAssetPreferences,
  universe,
  disabled = false,
  onForcedChange,
  onExcludedChange,
}: Props) {
  const [listOpen, setListOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [listQuery, setListQuery] = useState("")

  const forcedLimit = Math.min(maxAssetPreferences, Math.max(1, minStockCount))
  const excludedLimit = maxAssetPreferences
  const status: UniverseStatus = disabled ? "idle" : "ready"

  const searchMatches = useMemo(() => {
    const q = query.trim().toLocaleUpperCase("tr-TR")
    if (!q || status !== "ready") return []
    return universe
      .filter((asset) => {
        const code = asset.assetCode.toLocaleUpperCase("tr-TR")
        const name = asset.displayName.toLocaleUpperCase("tr-TR")
        return code.includes(q) || name.includes(q)
      })
      .slice(0, 8)
  }, [universe, query, status])

  const listFiltered = useMemo(() => {
    const q = listQuery.trim().toLocaleUpperCase("tr-TR")
    if (!q) return universe
    return universe.filter((asset) => {
      const code = asset.assetCode.toLocaleUpperCase("tr-TR")
      const name = asset.displayName.toLocaleUpperCase("tr-TR")
      return code.includes(q) || name.includes(q)
    })
  }, [universe, listQuery])

  const forcedSet = useMemo(() => new Set(forcedCodes), [forcedCodes])
  const excludedSet = useMemo(() => new Set(excludedCodes), [excludedCodes])
  const forceLimitReached = forcedCodes.length >= forcedLimit
  const excludeLimitReached = excludedCodes.length >= excludedLimit

  function addForced(code: string) {
    if (disabled) return
    if (forcedSet.has(code)) return
    if (forceLimitReached) return
    onForcedChange([...forcedCodes, code])
    onExcludedChange(excludedCodes.filter((item) => item !== code))
    setQuery("")
  }

  function addExcluded(code: string) {
    if (disabled) return
    if (excludedSet.has(code)) return
    if (excludeLimitReached) return
    onExcludedChange([...excludedCodes, code])
    onForcedChange(forcedCodes.filter((item) => item !== code))
    setQuery("")
  }

  function removeForced(code: string) {
    if (disabled) return
    onForcedChange(forcedCodes.filter((item) => item !== code))
  }

  function removeExcluded(code: string) {
    if (disabled) return
    onExcludedChange(excludedCodes.filter((item) => item !== code))
  }

  function clearAll() {
    if (disabled) return
    onForcedChange([])
    onExcludedChange([])
    setQuery("")
  }

  function openList() {
    if (disabled) return
    setListQuery("")
    setListOpen(true)
  }

  function closeList() {
    setListOpen(false)
  }

  const hasSelections = forcedCodes.length > 0 || excludedCodes.length > 0
  const searchEnabled = !disabled && status === "ready"

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        İsteğe bağlı. Kod veya şirket adıyla arayıp ekleyin. Tüm listeyi görmek
        için hisseleri listeleyin. Her listede en fazla{" "}
        {maxAssetPreferences} hisse.
      </p>

      <div className={styles.summaryCountsRow}>
        <p className={styles.summaryCounts}>
          Zorunlu {forcedCodes.length}/{forcedLimit}
          <span className={styles.summaryDot}>·</span>
          Hariç {excludedCodes.length}/{excludedLimit}
        </p>
        <div className={styles.summaryActions}>
          {hasSelections ? (
            <button
              type="button"
              className={styles.clearAllBtn}
              disabled={disabled}
              onClick={clearAll}
            >
              Tümünü temizle
            </button>
          ) : null}
          <button
            type="button"
            className={styles.openBtn}
            disabled={disabled || status !== "ready"}
            onClick={openList}
          >
            Hisseleri listele
          </button>
        </div>
      </div>

      <label className={styles.searchField} htmlFor="asset-pref-search">
        <span className={styles.searchLabel}>Hisse ara</span>
        <input
          id="asset-pref-search"
          className={styles.searchInput}
          type="search"
          placeholder="Örn. THYAO veya Anadolu Efes…"
          value={query}
          disabled={!searchEnabled}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </label>

      {status === "ready" && universe.length === 0 ? (
        <p className={styles.statusMsg} role="status">
          Model evreninde hisse bulunamadı.
        </p>
      ) : null}

      {query.trim() && status === "ready" && universe.length > 0 ? (
        <ul className={styles.results} role="listbox" aria-label="Arama sonuçları">
          {searchMatches.length === 0 ? (
            <li className={styles.emptyResult}>Eşleşen hisse yok</li>
          ) : (
            searchMatches.map((asset) => {
              const isForced = forcedSet.has(asset.assetCode)
              const isExcluded = excludedSet.has(asset.assetCode)
              return (
                <li key={asset.assetCode} className={styles.resultRow}>
                  <div className={styles.resultMeta}>
                    <span className={styles.resultCode}>{asset.assetCode}</span>
                    <span className={styles.resultName}>{asset.displayName}</span>
                  </div>
                  <ActionButtons
                    code={asset.assetCode}
                    isForced={isForced}
                    isExcluded={isExcluded}
                    disabled={disabled}
                    forceLimitReached={forceLimitReached}
                    excludeLimitReached={excludeLimitReached}
                    forcedLimit={forcedLimit}
                    excludedLimit={excludedLimit}
                    onAddForced={addForced}
                    onRemoveForced={removeForced}
                    onAddExcluded={addExcluded}
                    onRemoveExcluded={removeExcluded}
                  />
                </li>
              )
            })
          )}
        </ul>
      ) : null}

      {hasSelections ? (
        <div className={styles.summaryChips}>
          {forcedCodes.map((code) => (
            <button
              key={`f-${code}`}
              type="button"
              className={`${styles.chip} ${styles.chipForced}`}
              disabled={disabled}
              onClick={() => removeForced(code)}
              aria-label={`${code} zorunlu listesinden çıkar`}
            >
              <span>{labelFor(universe, code)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          {excludedCodes.map((code) => (
            <button
              key={`e-${code}`}
              type="button"
              className={`${styles.chip} ${styles.chipExcluded}`}
              disabled={disabled}
              onClick={() => removeExcluded(code)}
              aria-label={`${code} hariç listesinden çıkar`}
            >
              <span>{labelFor(universe, code)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.listEmpty}>Henüz hisse tercihi yok</p>
      )}

      <Dialog
        open={listOpen}
        onClose={closeList}
        labelledBy="asset-pref-dialog-title"
        describedBy="asset-pref-dialog-desc"
        className={styles.dialog}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h3 id="asset-pref-dialog-title" className={styles.dialogTitle}>
              Hisse listesi
            </h3>
            <p id="asset-pref-dialog-desc" className={styles.dialogDesc}>
              Model evrenindeki tüm hisseler. Satırdaki butonlarla zorunlu
              ekleyin veya hariç tutun.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeList}
            aria-label="Kapat"
          >
            ×
          </button>
        </header>

        <div className={styles.dialogToolbar}>
          <label className={styles.searchField} htmlFor="asset-pref-list-filter">
            <span className={styles.searchLabel}>Listede filtrele</span>
            <input
              id="asset-pref-list-filter"
              className={styles.searchInput}
              type="search"
              placeholder="Listede daralt…"
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              autoComplete="off"
            />
          </label>
          <p className={styles.toolbarMeta}>
            Zorunlu {forcedCodes.length}/{forcedLimit}
            <span className={styles.summaryDot}>·</span>
            Hariç {excludedCodes.length}/{excludedLimit}
            <span className={styles.summaryDot}>·</span>
            {listFiltered.length} hisse
            {hasSelections ? (
              <>
                <span className={styles.summaryDot}>·</span>
                <button
                  type="button"
                  className={styles.clearAllLink}
                  disabled={disabled}
                  onClick={clearAll}
                >
                  Tümünü temizle
                </button>
              </>
            ) : null}
          </p>
        </div>

        {listFiltered.length === 0 ? (
          <p className={styles.statusMsg} role="status">
            Eşleşen hisse yok.
          </p>
        ) : (
          <ul className={styles.assetList} aria-label="Hisse listesi">
            {listFiltered.map((asset) => {
              const isForced = forcedSet.has(asset.assetCode)
              const isExcluded = excludedSet.has(asset.assetCode)
              return (
                <li key={asset.assetCode} className={styles.assetRow}>
                  <div className={styles.resultMeta}>
                    <span className={styles.resultCode}>{asset.assetCode}</span>
                    <span className={styles.resultName}>{asset.displayName}</span>
                  </div>
                  <ActionButtons
                    code={asset.assetCode}
                    isForced={isForced}
                    isExcluded={isExcluded}
                    disabled={disabled}
                    forceLimitReached={forceLimitReached}
                    excludeLimitReached={excludeLimitReached}
                    forcedLimit={forcedLimit}
                    excludedLimit={excludedLimit}
                    onAddForced={addForced}
                    onRemoveForced={removeForced}
                    onAddExcluded={addExcluded}
                    onRemoveExcluded={removeExcluded}
                  />
                </li>
              )
            })}
          </ul>
        )}

        <footer className={styles.dialogFooter}>
          <button type="button" className={styles.doneBtn} onClick={closeList}>
            Tamam
          </button>
        </footer>
      </Dialog>
    </div>
  )
}
