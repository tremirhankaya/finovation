import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"

import { fetchOptimizationLogs } from "@/features/optimization/api/optimizationApi"
import {
  formatDateTime,
  REQUEST_STATUS_LABELS,
} from "@/features/optimization/lib/optimizationExportLabels"
import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import type { OptimizationLogEntry } from "@/features/optimization/model/optimizationSchemas"
import styles from "@/features/optimization/styles/OptimizationLogsPage.module.css"

function logActorName(log: OptimizationLogEntry): string {
  return (
    log.decidedByDisplayName ??
    log.decidedByUsername ??
    log.requestedByDisplayName ??
    log.requestedByUsername ??
    "—"
  )
}

function logStatusTitle(log: OptimizationLogEntry): string | undefined {
  if (log.status === "FAILED" && log.errorMessage) return log.errorMessage
  if (log.status === "REJECTED" && log.rejectionReason) {
    return log.rejectionReason
  }
  return undefined
}

const ALL_FUNDS_VALUE = ""

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10)
}

export default function OptimizationLogsPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<OptimizationLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const [fundFilter, setFundFilter] = useState(ALL_FUNDS_VALUE)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [pdfRequestId, setPdfRequestId] = useState<number | null>(null)
  const [pdfErrorMessage, setPdfErrorMessage] = useState("")
  const [excelRequestId, setExcelRequestId] = useState<number | null>(null)
  const [excelErrorMessage, setExcelErrorMessage] = useState("")
  const [isExportingLogs, setIsExportingLogs] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const result = await fetchOptimizationLogs()
        if (!cancelled) setLogs(result)
      } catch (error) {
        if (!cancelled) setErrorMessage(getOptimizationErrorMessage(error))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const fundOptions = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.fundName))).sort((a, b) =>
        a.localeCompare(b, "tr-TR"),
      ),
    [logs],
  )

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (fundFilter && log.fundName !== fundFilter) return false
      const logDate = toDateInputValue(log.createdAt)
      if (dateFrom && logDate < dateFrom) return false
      if (dateTo && logDate > dateTo) return false
      return true
    })
  }, [logs, fundFilter, dateFrom, dateTo])

  const handleExportLogs = async () => {
    setIsExportingLogs(true)
    try {
      const { downloadOptimizationLogsExcel } = await import(
        "@/features/optimization/lib/optimizationLogsExcelExport"
      )
      await downloadOptimizationLogsExcel(filteredLogs)
    } finally {
      setIsExportingLogs(false)
    }
  }

  const handleDownloadPdf = async (log: OptimizationLogEntry) => {
    setPdfErrorMessage("")
    setPdfRequestId(log.requestId)
    try {
      const { loadOptimizationResultExportInput } = await import(
        "@/features/optimization/lib/optimizationResultExportData"
      )
      const { downloadOptimizationResultPdf } = await import(
        "@/features/optimization/lib/optimizationPdfExport"
      )
      const input = await loadOptimizationResultExportInput(
        log.requestId,
        log.fundName,
      )
      await downloadOptimizationResultPdf(input)
    } catch (error) {
      setPdfErrorMessage(getOptimizationErrorMessage(error))
    } finally {
      setPdfRequestId(null)
    }
  }

  const handleDownloadExcel = async (log: OptimizationLogEntry) => {
    setExcelErrorMessage("")
    setExcelRequestId(log.requestId)
    try {
      const { loadOptimizationResultExportInput } = await import(
        "@/features/optimization/lib/optimizationResultExportData"
      )
      const { downloadOptimizationResultExcel } = await import(
        "@/features/optimization/lib/optimizationExcelExport"
      )
      const input = await loadOptimizationResultExportInput(
        log.requestId,
        log.fundName,
      )
      await downloadOptimizationResultExcel(input)
    } catch (error) {
      setExcelErrorMessage(getOptimizationErrorMessage(error))
    } finally {
      setExcelRequestId(null)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.headerRow}>
          <div>
            <h1>İşlem Logları</h1>
            <p className={styles.subtitle}>
              Fon optimizasyonu modülünde yaptığınız tüm işlemler denetim
              amacıyla kaydedilir
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate("/optimization-requests/new")}
            >
              ← Fon Optimizasyonuna Dön
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={() => void handleExportLogs()}
              disabled={isExportingLogs || filteredLogs.length === 0}
            >
              ↓ {isExportingLogs ? "Hazırlanıyor…" : "Kayıtları Dışa Aktar"}
            </button>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.panelEyebrow}>
            <span className={styles.panelEyebrowDot} />
            Denetim Kayıtları
          </div>

          <div className={styles.filtersRow}>
            <div className={styles.filterField}>
              <label htmlFor="logs-fund-filter">Fon</label>
              <select
                id="logs-fund-filter"
                value={fundFilter}
                onChange={(event) => setFundFilter(event.target.value)}
              >
                <option value={ALL_FUNDS_VALUE}>Tüm fonlar</option>
                {fundOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterField}>
              <label htmlFor="logs-date-from">Başlangıç</label>
              <input
                id="logs-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className={styles.filterField}>
              <label htmlFor="logs-date-to">Bitiş</label>
              <input
                id="logs-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <span className={styles.resultCount}>
              {filteredLogs.length} kayıt
            </span>
          </div>

          {isLoading && (
            <div className={styles.loadingBanner} role="status">
              İşlem logları yükleniyor…
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className={styles.errorBanner} role="alert">
              {errorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && pdfErrorMessage && (
            <div className={styles.errorBanner} role="alert">
              {pdfErrorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && excelErrorMessage && (
            <div className={styles.errorBanner} role="alert">
              {excelErrorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && filteredLogs.length === 0 && (
            <p className={styles.emptyState}>
              Filtrenizle eşleşen bir işlem kaydı bulunamadı.
            </p>
          )}

          {!isLoading && !errorMessage && filteredLogs.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.logsTable}>
                <thead>
                  <tr>
                    <th>Tarih ve Saat</th>
                    <th>Kullanıcı</th>
                    <th>Fon</th>
                    <th>Sonuç</th>
                    <th>Mali Raporu</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.requestId}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{logActorName(log)}</td>
                      <td className={styles.fundCell}>{log.fundName}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            styles[`statusBadge${log.status}`] ?? ""
                          }`}
                          title={logStatusTitle(log)}
                        >
                          {REQUEST_STATUS_LABELS[log.status] ?? log.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.pdfButton}
                            disabled={
                              !log.resultAvailable ||
                              pdfRequestId === log.requestId
                            }
                            onClick={() => void handleDownloadPdf(log)}
                          >
                            ↓{" "}
                            {pdfRequestId === log.requestId
                              ? "Hazırlanıyor…"
                              : "PDF"}
                          </button>
                          <button
                            type="button"
                            className={styles.excelButton}
                            disabled={
                              !log.resultAvailable ||
                              excelRequestId === log.requestId
                            }
                            onClick={() => void handleDownloadExcel(log)}
                          >
                            ↓{" "}
                            {excelRequestId === log.requestId
                              ? "Hazırlanıyor…"
                              : "Excel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
