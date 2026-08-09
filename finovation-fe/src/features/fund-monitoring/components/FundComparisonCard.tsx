import { useEffect, useId, useMemo, useRef, useState } from "react"

import ComparisonBarChart from "@/features/fund-monitoring/components/ComparisonBarChart"
import { formatPercentage } from "@/features/fund-monitoring/lib/fundMonitoringFormatters"
import {
  COMPARISON_PERIODS,
  type BenchmarkDefinition,
  type ComparisonPeriod,
  type FundComparisonAsset,
} from "@/features/fund-monitoring/model/fundMonitoring.types"
import styles from "@/features/fund-monitoring/styles/FundMonitoringPage.module.css"

type FundComparisonCardProps = {
  assets: FundComparisonAsset[]
  benchmark?: BenchmarkDefinition
  selectedFundId?: string
}

type ComparisonView = "chart" | "table"
type ExportKind = "print" | "excel" | "csv" | "pdf"

const MAX_SELECTED_ASSETS = 10
const DEFAULT_COMPARISON_ASSET_IDS = new Set([
  "official-equity-benchmark",
  "bist-100-return",
  "bist-30",
  "deposit-try",
  "inflation",
  "gold-try",
  "usd-try",
  "eur-try",
])

function defaultSelectedIds(
  assets: FundComparisonAsset[],
  selectedFundId?: string,
): string[] {
  return assets
    .filter(
      (asset) =>
        asset.id === selectedFundId ||
        DEFAULT_COMPARISON_ASSET_IDS.has(asset.id),
    )
    .slice(0, MAX_SELECTED_ASSETS)
    .map((asset) => asset.id)
}

function isSimilarFund(asset: FundComparisonAsset): boolean {
  return asset.id.startsWith("similar-fund-")
}

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
  benchmark,
  selectedFundId,
}: FundComparisonCardProps) {
  const [period, setPeriod] = useState<ComparisonPeriod>("1Y")
  const [view, setView] = useState<ComparisonView>("chart")
  const [selectedIds, setSelectedIds] = useState(() =>
    defaultSelectedIds(assets, selectedFundId),
  )
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const dialogTitleId = useId()
  const benchmarkTooltipId = useId()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedIds(defaultSelectedIds(assets, selectedFundId))
  }, [assets, selectedFundId])

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

  const pickerGroups = [
    {
      id: "market",
      label: "Piyasa ve Ekonomik Göstergeler",
      assets: availableAssets.filter((asset) => !asset.isFund),
    },
    {
      id: "user-funds",
      label: "Fonlarım",
      assets: availableAssets.filter(
        (asset) => asset.isFund && !isSimilarFund(asset),
      ),
    },
    {
      id: "similar-funds",
      label: "Benzer Fonlar",
      assets: availableAssets.filter(isSimilarFund),
    },
  ].filter((group) => group.assets.length > 0)

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
          <span>Karşılaştırmaya varlık ekle</span>
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
        {selectedAssets.map((asset) => {
          const showsBenchmarkHelp =
            asset.id === "official-equity-benchmark" &&
            Boolean(benchmark?.components.length)

          return (
            <div className={styles.comparisonChecklistItem} key={asset.id}>
              <label className={asset.isFund ? styles.fundChecklistItem : ""}>
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleAsset(asset.id)}
                />
                <span
                  style={{ backgroundColor: asset.color }}
                  aria-hidden="true"
                >
                  ✓
                </span>
                {asset.name}
              </label>
              {showsBenchmarkHelp && (
                <span className={styles.benchmarkHelp}>
                  <button
                    type="button"
                    aria-label="Benchmark karşılaştırma ölçütü değerleri"
                    aria-describedby={benchmarkTooltipId}
                  >
                    i
                  </button>
                  <span id={benchmarkTooltipId} role="tooltip">
                    <strong>{benchmark?.name}</strong>
                    {benchmark?.components.map((component) => (
                      <span
                        className={styles.benchmarkComponent}
                        key={component.code}
                      >
                        <span>{component.name}</span>
                        <b>
                          %{component.weightPercentage.toLocaleString("tr-TR")}
                        </b>
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className={styles.comparisonHint}>
        {assets.length === 0
          ? "Karşılaştırma verileri aktif bir fon oluşturulduğunda burada gösterilecek."
          : "En fazla 10 varlık karşılaştırılabilir. Eklemek için varlık seçiciyi, kaldırmak için listedeki tiki kullanın."}
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
              {pickerGroups.length === 0 ? (
                <p>Eklenebilecek eşleşen varlık bulunmuyor.</p>
              ) : (
                pickerGroups.map((group) => (
                  <section className={styles.pickerGroup} key={group.id}>
                    <h3>{group.label}</h3>
                    {group.assets.map((asset) => (
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
                    ))}
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
