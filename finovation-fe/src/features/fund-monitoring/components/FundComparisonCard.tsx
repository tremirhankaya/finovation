import { useEffect, useId, useMemo, useRef, useState } from "react"

import ComparisonBarChart from "@/features/fund-monitoring/components/ComparisonBarChart"
import { formatPercentage } from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import {
  COMPARISON_PERIODS,
  type ComparisonPeriod,
  type FundComparisonAsset,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundComparisonCardProps = {
  assets: FundComparisonAsset[]
}

type ComparisonView = "chart" | "table"
type ExportKind = "copy" | "print" | "excel" | "csv" | "pdf"

const MAX_SELECTED_ASSETS = 10

function sortAssets(
  assets: FundComparisonAsset[],
  period: ComparisonPeriod,
): FundComparisonAsset[] {
  return [...assets].sort((left, right) => {
    const leftValue = left.returns[period]
    const rightValue = right.returns[period]
    if (leftValue == null) return rightValue == null ? 0 : 1
    if (rightValue == null) return -1
    return rightValue - leftValue
  })
}

function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function FundComparisonCard({
  assets,
}: FundComparisonCardProps) {
  const [period, setPeriod] = useState<ComparisonPeriod>("1Y")
  const [view, setView] = useState<ComparisonView>("chart")
  const [selectedIds, setSelectedIds] = useState(() =>
    assets.slice(0, MAX_SELECTED_ASSETS).map((asset) => asset.id),
  )
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const dialogTitleId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedIds(
      assets.slice(0, MAX_SELECTED_ASSETS).map((asset) => asset.id),
    )
  }, [assets])

  useEffect(() => {
    if (!isPickerOpen) return

    searchInputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [isPickerOpen])

  const selectedAssets = useMemo(
    () =>
      sortAssets(
        assets.filter((asset) => selectedIds.includes(asset.id)),
        period,
      ),
    [assets, period, selectedIds],
  )
  const periodMeta = COMPARISON_PERIODS.find((item) => item.value === period)!
  const availableAssets = assets.filter((asset) => {
    if (selectedIds.includes(asset.id)) return false
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")
    return (
      normalizedQuery.length === 0 ||
      asset.name.toLocaleLowerCase("tr-TR").includes(normalizedQuery) ||
      asset.code.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
    )
  })

  const toggleAsset = (assetId: string) => {
    setSelectedIds((current) => {
      if (current.includes(assetId)) {
        setStatusMessage("")
        return current.filter((id) => id !== assetId)
      }
      if (current.length >= MAX_SELECTED_ASSETS) {
        setStatusMessage("En fazla 10 varlık karşılaştırılabilir.")
        return current
      }
      setStatusMessage("")
      return [...current, assetId]
    })
  }

  const handleExport = async (kind: ExportKind) => {
    const rows = [
      ["Fon / Varlık Kodu", "Adı", periodMeta.columnLabel],
      ...selectedAssets.map((asset) => [
        asset.code,
        asset.name,
        formatPercentage(asset.returns[period] ?? null),
      ]),
    ]
    const tabSeparated = rows.map((row) => row.join("\t")).join("\n")

    if (kind === "print" || kind === "pdf") {
      window.print()
      setStatusMessage(
        kind === "pdf"
          ? "PDF için yazdırma penceresinde ‘PDF olarak kaydet’i seçin."
          : "Yazdırma penceresi açıldı.",
      )
      return
    }

    if (kind === "copy") {
      try {
        await navigator.clipboard.writeText(tabSeparated)
        setStatusMessage("Karşılaştırma panoya kopyalandı.")
      } catch {
        setStatusMessage("Kopyalama izni verilemedi.")
      }
      return
    }

    if (kind === "csv") {
      const csv = rows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"),
        )
        .join("\n")
      downloadFile(
        `\uFEFF${csv}`,
        "fon-getiri-karsilastirma.csv",
        "text/csv;charset=utf-8",
      )
      setStatusMessage("CSV dosyası indirildi.")
      return
    }

    downloadFile(
      `\uFEFF${tabSeparated}`,
      "fon-getiri-karsilastirma.xls",
      "application/vnd.ms-excel;charset=utf-8",
    )
    setStatusMessage("Excel dosyası indirildi.")
  }

  return (
    <section className={`${styles.card} ${styles.comparisonCard}`}>
      <h2 className={styles.comparisonTitle}>Fon Getiri Karşılaştır</h2>

      <div className={styles.comparisonToolbar}>
        <button
          className={styles.comparisonSearch}
          type="button"
          disabled={assets.length === 0}
          onClick={() => setPickerOpen(true)}
        >
          <span>Aradığınız fonun kodunu veya adını yazınız</span>
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>
        </button>

        <div className={styles.viewToggle} aria-label="Karşılaştırma görünümü">
          <button
            type="button"
            className={view === "chart" ? styles.activeView : ""}
            aria-pressed={view === "chart"}
            onClick={() => setView("chart")}
          >
            Grafik
          </button>
          <button
            type="button"
            className={view === "table" ? styles.activeView : ""}
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            Tablo
          </button>
        </div>
      </div>

      <div className={styles.comparisonPeriods} aria-label="Getiri dönemi">
        {COMPARISON_PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              period === item.value ? styles.activeComparisonPeriod : ""
            }
            aria-pressed={period === item.value}
            onClick={() => setPeriod(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.comparisonExport}>
        <button type="button" onClick={() => void handleExport("copy")}>
          Kopyala
        </button>
        <button type="button" onClick={() => void handleExport("print")}>
          Yazdır
        </button>
        <button type="button" onClick={() => void handleExport("excel")}>
          Excel
        </button>
        <button type="button" onClick={() => void handleExport("csv")}>
          CSV
        </button>
        <button type="button" onClick={() => void handleExport("pdf")}>
          PDF
        </button>
      </div>

      {view === "chart" ? (
        <div className={styles.comparisonChart}>
          <ComparisonBarChart assets={selectedAssets} period={period} />
        </div>
      ) : (
        <div className={styles.comparisonTableWrap}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Fon / Varlık Kodu</th>
                <th>Adı</th>
                <th>{periodMeta.columnLabel}</th>
              </tr>
            </thead>
            <tbody>
              {selectedAssets.map((asset) => {
                const value = asset.returns[period] ?? null
                return (
                  <tr key={asset.id}>
                    <td>
                      <span
                        style={{ backgroundColor: asset.color }}
                        aria-hidden="true"
                      />
                      {asset.code}
                    </td>
                    <td>{asset.name}</td>
                    <td
                      className={
                        value !== null && value < 0
                          ? styles.negative
                          : styles.positive
                      }
                    >
                      {formatPercentage(value)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.comparisonChecklist}>
        {assets.map((asset) => {
          const isSelected = selectedIds.includes(asset.id)
          return (
            <label
              key={asset.id}
              className={asset.isFund ? styles.fundChecklistItem : ""}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleAsset(asset.id)}
              />
              <span
                style={
                  isSelected ? { backgroundColor: asset.color } : undefined
                }
                aria-hidden="true"
              >
                {isSelected ? "✓" : ""}
              </span>
              {asset.name}
            </label>
          )
        })}
      </div>

      <p className={styles.comparisonHint}>
        {assets.length === 0
          ? "Karşılaştırma verileri aktif bir fon oluşturulduğunda burada gösterilecek."
          : "En fazla 10 varlık karşılaştırılabilir. Kaldırmak için yukarıdaki listeden tikini kaldırın."}
      </p>
      <p className={styles.comparisonStatus} aria-live="polite">
        {statusMessage}
      </p>

      {isPickerOpen && (
        <div className={styles.pickerOverlay}>
          <div
            className={styles.assetPicker}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <div className={styles.pickerHeader}>
              <label>
                <span id={dialogTitleId}>Karşılaştırmaya varlık ekle</span>
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Fon kodu veya varlık adı yazınız..."
                />
              </label>
              <button type="button" onClick={() => setPickerOpen(false)}>
                Kapat
              </button>
            </div>
            <div className={styles.pickerList}>
              {availableAssets.length === 0 ? (
                <p>Eklenebilecek eşleşen varlık bulunmuyor.</p>
              ) : (
                availableAssets.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    onClick={() => {
                      toggleAsset(asset.id)
                      setPickerOpen(false)
                      setQuery("")
                    }}
                  >
                    <span
                      style={{ backgroundColor: asset.color }}
                      aria-hidden="true"
                    />
                    <strong>{asset.name}</strong>
                    <small>{asset.code}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
