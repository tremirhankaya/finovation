import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"

import {
  completeFundDraft,
  type FundPositionResponse,
} from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import { MANAGEMENT_APPROACHES } from "@/features/fund-design/model/managementApproach"
import { FundLoader } from "@/shared/ui/FundLoader"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundDesignApprovalPage.module.css"

type RuleRow = {
  key: string
  label: string
  range: string
  actual: string
  pct: number
  status: "ok" | "warn" | "bad"
}

function formatPct(value: number): string {
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function approachLabel(code: string | null | undefined): string {
  if (!code) return "—"
  return MANAGEMENT_APPROACHES.find((item) => item.code === code)?.label ?? code
}

function proposalLabel(sourceRank: number | null | undefined): string {
  if (sourceRank == null) return "Kendi düzenlemeniz"
  if (sourceRank === 1) return "AI Birincil Önerisi"
  return `AI ${sourceRank}. Önerisi`
}

/* ── Icons ── */
const TagIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#2ec4a7" }}
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
    <line x1="7" y1="7" x2="7.01" y2="7"></line>
  </svg>
)
const DollarIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#3b82f6" }}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
    <line x1="12" y1="18" x2="12" y2="22"></line>
    <line x1="12" y1="2" x2="12" y2="6"></line>
  </svg>
)
const ShieldIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#8b5cf6" }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="M9 12l2 2 4-4"></path>
  </svg>
)
const LiquidityIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#0ea5e9" }}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
  </svg>
)
const BarChartIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#6366f1" }}
  >
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
)
const StarIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#f59e0b" }}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
)

/* ── Section Icons ── */
const DocIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#2ec4a7" }}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
)
const ShieldCheckIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#3b82f6" }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <path d="M9 12l2 2 4-4"></path>
  </svg>
)
const TargetIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: "#6366f1" }}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
)

export default function FundDesignApprovalPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()

  const {
    init,
    error: initError,
    isLoading: isInitLoading,
  } = useFundDraftInit({
    page: "APPROVAL",
    draftId,
  })
  const approvalInit = init?.page === "APPROVAL" ? init : null

  const [positions, setPositions] = useState<FundPositionResponse[]>([])
  const [sourceRank, setSourceRank] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [formError, setFormError] = useState("")
  const isScreenLoading =
    isInitLoading || (approvalInit != null && isLoading)

  useEffect(() => {
    if (approvalInit?.workingPortfolio) {
      setPositions(approvalInit.workingPortfolio.assets)
      setSourceRank(approvalInit.workingPortfolio.sourceRank ?? null)
      setIsLoading(false)
    }
  }, [approvalInit?.workingPortfolio])

  const summary = useMemo(() => {
    const equities = positions.filter((p) => p.asset_type === "EQUITY")
    const tppWeight = positions
      .filter((p) => p.asset_type === "TPP")
      .reduce((acc, p) => acc + p.weight, 0)
    const equityWeight = equities.reduce((acc, p) => acc + p.weight, 0)

    const threshold = approvalInit?.aboveThresholdPct ?? 5
    const aboveThresholdSum = equities
      .filter((p) => p.weight > threshold)
      .reduce((acc, p) => acc + p.weight, 0)

    const weightBySector = new Map<string, number>()
    equities.forEach((p) => {
      if (!p.sector_name) return
      weightBySector.set(
        p.sector_name,
        (weightBySector.get(p.sector_name) ?? 0) + p.weight,
      )
    })

    return {
      equityWeight,
      tppWeight,
      aboveThresholdSum,
      maxSingleStock: equities.reduce((acc, p) => Math.max(acc, p.weight), 0),
      maxSector: Math.max(0, ...weightBySector.values()),
      stockCount: equities.length,
    }
  }, [positions, approvalInit])

  const ruleRows: RuleRow[] = useMemo(() => {
    if (!approvalInit) return []

    return [
      {
        key: "equity",
        label: "Hisse Senedi Oranı",
        range: `%${approvalInit.minEquityWeightPct} - %${approvalInit.maxEquityWeightPct}`,
        actual: `%${formatPct(summary.equityWeight)}`,
        pct: (summary.equityWeight / approvalInit.maxEquityWeightPct) * 100,
        status:
          summary.equityWeight >= approvalInit.minEquityWeightPct &&
          summary.equityWeight <= approvalInit.maxEquityWeightPct
            ? "ok"
            : "bad",
      },
      {
        key: "tpp",
        label: "TPP Oranı",
        range: `%${approvalInit.minLiquidityTargetPct} - %${approvalInit.maxLiquidityTargetPct}`,
        actual: `%${formatPct(summary.tppWeight)}`,
        pct: (summary.tppWeight / approvalInit.maxLiquidityTargetPct) * 100,
        status:
          summary.tppWeight >= approvalInit.minLiquidityTargetPct &&
          summary.tppWeight <= approvalInit.maxLiquidityTargetPct
            ? "ok"
            : "bad",
      },
      {
        key: "singleStock",
        label: "Tek Hisse Ağırlığı",
        range: `%${approvalInit.minSingleStockMaxPct ?? 3} - %${approvalInit.maxSingleStockMaxPct}`,
        actual: `%${formatPct(summary.maxSingleStock)}`,
        pct: (summary.maxSingleStock / approvalInit.maxSingleStockMaxPct) * 100,
        status:
          summary.maxSingleStock <= approvalInit.maxSingleStockMaxPct
            ? "ok"
            : "bad",
      },
      {
        key: "aboveThreshold",
        label: `%${approvalInit.aboveThresholdPct} Üzerindeki Hisselerin Toplamı`,
        range: `<= %${approvalInit.aboveThresholdSumMax}`,
        actual: `%${formatPct(summary.aboveThresholdSum)}`,
        pct:
          (summary.aboveThresholdSum / approvalInit.aboveThresholdSumMax) * 100,
        status:
          summary.aboveThresholdSum <= approvalInit.aboveThresholdSumMax
            ? "ok"
            : "bad",
      },
      {
        key: "sector",
        label: "Sektör Ağırlığı",
        range: `Maks. %${approvalInit.sectorMaxPct}`,
        actual: `%${formatPct(summary.maxSector)}`,
        pct: (summary.maxSector / approvalInit.sectorMaxPct) * 100,
        status: summary.maxSector <= approvalInit.sectorMaxPct ? "ok" : "bad",
      },
      {
        key: "stockCount",
        label: "Hisse Sayısı",
        range: `${approvalInit.minStockCount} - ${approvalInit.maxStockCount}`,
        actual: `${summary.stockCount}`,
        pct: (summary.stockCount / approvalInit.maxStockCount) * 100,
        status:
          summary.stockCount >= approvalInit.minStockCount &&
          summary.stockCount <= approvalInit.maxStockCount
            ? "ok"
            : "bad",
      },
    ] as RuleRow[]
  }, [approvalInit, summary])

  // User preference rows
  const userRows: RuleRow[] = useMemo(() => {
    if (!approvalInit) return []
    const { draft } = approvalInit
    const rows: RuleRow[] = []

    if (draft.tppMinPct != null || draft.tppMaxPct != null) {
      const min = draft.tppMinPct ?? approvalInit.minLiquidityTargetPct
      const max = draft.tppMaxPct ?? approvalInit.maxLiquidityTargetPct
      rows.push({
        key: "user_tpp",
        label: "Özel TPP Oranı",
        range: `%${min} - %${max}`,
        actual: `%${formatPct(summary.tppWeight)}`,
        pct: (summary.tppWeight / max) * 100,
        status:
          summary.tppWeight >= min && summary.tppWeight <= max ? "ok" : "warn",
      })
    }

    if (draft.minStockCount != null || draft.maxStockCount != null) {
      const min = draft.minStockCount ?? approvalInit.minStockCount
      const max = draft.maxStockCount ?? approvalInit.maxStockCount
      rows.push({
        key: "user_stockCount",
        label: "Özel Hisse Sayısı",
        range: `${min} - ${max}`,
        actual: `${summary.stockCount}`,
        pct: (summary.stockCount / max) * 100,
        status:
          summary.stockCount >= min && summary.stockCount <= max
            ? "ok"
            : "warn",
      })
    }

    return rows
  }, [approvalInit, summary])

  // Forced / excluded asset analysis
  const forcedInfo = useMemo(() => {
    if (!approvalInit) return null
    const { draft } = approvalInit
    if (!draft.forcedAssetCodes || draft.forcedAssetCodes.length === 0)
      return null
    const missing = draft.forcedAssetCodes.filter(
      (code) => !positions.some((p) => p.asset_code === code),
    )
    return {
      codes: draft.forcedAssetCodes,
      total: draft.forcedAssetCodes.length,
      inPortfolio: draft.forcedAssetCodes.length - missing.length,
      missing,
    }
  }, [approvalInit, positions])

  const excludedInfo = useMemo(() => {
    if (!approvalInit) return null
    const { draft } = approvalInit
    if (!draft.excludedAssetCodes || draft.excludedAssetCodes.length === 0)
      return null
    const present = draft.excludedAssetCodes.filter((code) =>
      positions.some((p) => p.asset_code === code),
    )
    return {
      codes: draft.excludedAssetCodes,
      total: draft.excludedAssetCodes.length,
      removedCount: draft.excludedAssetCodes.length - present.length,
      present,
    }
  }, [approvalInit, positions])

  const hasViolation = ruleRows.some((row) => row.status === "bad")
  const canSubmit = isConfirmed && !hasViolation && !isSaving && !isLoading

  async function handleComplete() {
    if (!draftId || !canSubmit) return
    setIsSaving(true)
    setFormError("")
    try {
      await completeFundDraft(draftId)
      void navigate(`/fund-design/${draftId}/completed`)
    } catch (completeError) {
      setFormError(
            completeError instanceof Error
              ? completeError.message
              : "Fon tamamlanamadı.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const designMode = approvalInit?.draft.designMode ?? "AI_ASSISTED"

  return (
    <FundDesignLayout
      step={6}
      designMode={designMode}
      isLoading={isScreenLoading}
      wide
    >
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>SON KONTROL · FON TASARIMI</span>
            <h2 className={styles.sectionTitle}>
              {designMode === "MANUAL" ? "2. Fon Onayı" : "6. Fon Onayı"}
            </h2>
            <p className={styles.intro}>
              Tasarımınızı son kez gözden geçirin ve fonunuzu yayınlamak için
              onaylayın. Onay sonrası fon tasarımı üzerinde değişiklik yapılamaz.
            </p>
          </div>
          <div
            className={[
              styles.reviewState,
              hasViolation ? styles.reviewStateAlert : styles.reviewStateOk,
            ].join(" ")}
          >
            <span className={styles.reviewStateIcon} aria-hidden="true">
              {hasViolation ? "!" : "✓"}
            </span>
            <span>
              <strong>{hasViolation ? "Düzeltme gerekli" : "Yayınlamaya hazır"}</strong>
              <small>
                {hasViolation
                  ? "Kural kontrolünde iyileştirme bekleniyor"
                  : "Tüm kontroller tamamlandı"}
              </small>
            </span>
          </div>
        </header>

        {initError && <FormAlert>{initError}</FormAlert>}
        {formError && <FormAlert>{formError}</FormAlert>}

        {isScreenLoading ? (
          <div className={styles.card}>
            <FundLoader message="Özet hazırlanıyor..." />
          </div>
        ) : (
          <>
            {/* TASLAK OZETI - horizontal summary */}
            <div className={[styles.card, styles.summaryCard].join(" ")}>
              <h3 className={styles.cardTitle}>
                <span className={styles.titleIcon}>
                  <DocIcon />
                </span>
                TASLAK ÖZETİ
              </h3>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryIconBox}>
                    <TagIcon />
                  </div>
                  <div className={styles.summaryTextBox}>
                    <span className={styles.summaryLabel}>Fon Adı</span>
                    <span className={styles.summaryValue}>
                      {approvalInit.draft.name ?? "—"}
                    </span>
                  </div>
                </div>
                <div className={styles.summaryItem}>
                  <div className={styles.summaryIconBox}>
                    <DollarIcon />
                  </div>
                  <div className={styles.summaryTextBox}>
                    <span className={styles.summaryLabel}>Fon Pay Fiyatı</span>
                    <span className={styles.summaryValue}>
                      {formatMoney(approvalInit.draft.unitPrice)}
                    </span>
                  </div>
                </div>
                {approvalInit.draft.designMode !== "MANUAL" && (
                  <>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryIconBox}>
                        <ShieldIcon />
                      </div>
                      <div className={styles.summaryTextBox}>
                        <span className={styles.summaryLabel}>
                          Yönetim Yaklaşımı
                        </span>
                        <span className={styles.summaryValue}>
                          {approachLabel(approvalInit.draft.managementApproach)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryIconBox}>
                        <LiquidityIcon />
                      </div>
                      <div className={styles.summaryTextBox}>
                        <span className={styles.summaryLabel}>
                          Hedef Likidite
                        </span>
                        <span className={styles.summaryValue}>
                          {approvalInit.draft.preferredTppPct == null
                            ? "—"
                            : `%${approvalInit.draft.preferredTppPct} (TPP)`}
                        </span>
                      </div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryIconBox}>
                        <BarChartIcon />
                      </div>
                      <div className={styles.summaryTextBox}>
                        <span className={styles.summaryLabel}>
                          Min. Hisse Sayısı
                        </span>
                        <span className={styles.summaryValue}>
                          {approvalInit.draft.minStockCount ?? "—"}
                        </span>
                      </div>
                    </div>
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryIconBox}>
                        <StarIcon />
                      </div>
                      <div className={styles.summaryTextBox}>
                        <span className={styles.summaryLabel}>
                          Seçilen Portföy
                        </span>
                        <span className={styles.summaryValue}>
                          {proposalLabel(sourceRank)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className={styles.createdAt}>
                Oluşturulma: {formatDateTime(approvalInit.draft.createdAt)}
              </p>
            </div>

            {/* IZAHNAME VE KURAL KONTROLU */}
            <div className={[styles.card, styles.rulesCard].join(" ")}>
              <h3 className={styles.cardTitle}>
                <span className={styles.titleIcon}>
                  <ShieldCheckIcon />
                </span>
                İZAHNAME VE KURAL KONTROLÜ
              </h3>
              <table className={styles.ruleTable}>
                <thead>
                  <tr>
                    <th className={styles.thLeft}>Kriter</th>
                    <th className={styles.thLeft}>İzin Verilen Aralık</th>
                    <th className={styles.thLeft}>Mevcut Değer</th>
                    <th className={styles.thRight}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {ruleRows.map((row) => (
                    <tr key={row.key}>
                      <td className={styles.tdLabel}>
                        <span
                          className={[
                            styles.dot,
                            row.status === "ok" ? styles.dotOk : styles.dotBad,
                          ].join(" ")}
                        />
                        {row.label}
                      </td>
                      <td className={styles.tdRange}>{row.range}</td>
                      <td className={styles.tdValue}>
                        <span className={styles.valueText}>{row.actual}</span>
                        <div className={styles.bar}>
                          <div
                            className={[
                              styles.barFill,
                              row.status === "ok"
                                ? styles.barOk
                                : styles.barBad,
                            ].join(" ")}
                            style={{ width: `${Math.min(100, row.pct)}%` }}
                          />
                        </div>
                      </td>
                      <td className={styles.tdStatus}>
                        <span
                          className={[
                            styles.statusBadge,
                            row.status === "ok"
                              ? styles.badgeOk
                              : styles.badgeBad,
                          ].join(" ")}
                        >
                          {row.status === "ok" ? "Uygun" : "Uygun Değil"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* KRITERLERINIZE UYGUNLUK */}
            {(userRows.length > 0 || forcedInfo || excludedInfo) &&
              approvalInit?.draft?.designMode !== "MANUAL" && (
                <div className={[styles.card, styles.preferencesCard].join(" ")}>
                  <h3 className={styles.cardTitle}>
                    <span className={styles.titleIcon}>
                      <TargetIcon />
                    </span>
                    KRİTERLERİNİZE UYGUNLUK
                  </h3>

                  {userRows.length > 0 && (
                    <table className={styles.ruleTable}>
                      <thead>
                        <tr>
                          <th className={styles.thLeft}>Kriter</th>
                          <th className={styles.thLeft}>Aralık</th>
                          <th className={styles.thLeft}>Mevcut Değer</th>
                          <th className={styles.thRight}>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userRows.map((row) => (
                          <tr key={row.key}>
                            <td className={styles.tdLabel}>
                              <span
                                className={[
                                  styles.dot,
                                  row.status === "ok"
                                    ? styles.dotOk
                                    : styles.dotWarn,
                                ].join(" ")}
                              />
                              {row.label}
                            </td>
                            <td className={styles.tdRange}>{row.range}</td>
                            <td className={styles.tdValue}>
                              <span className={styles.valueText}>
                                {row.actual}
                              </span>
                              <div className={styles.bar}>
                                <div
                                  className={[
                                    styles.barFill,
                                    row.status === "ok"
                                      ? styles.barOk
                                      : styles.barWarn,
                                  ].join(" ")}
                                  style={{
                                    width: `${Math.min(100, row.pct)}%`,
                                  }}
                                />
                              </div>
                            </td>
                            <td className={styles.tdStatus}>
                              <span
                                className={[
                                  styles.statusBadge,
                                  row.status === "ok"
                                    ? styles.badgeOk
                                    : styles.badgeWarn,
                                ].join(" ")}
                              >
                                {row.status === "ok" ? "Uygun" : "Uygun Değil"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {(forcedInfo || excludedInfo) && (
                    <div className={styles.assetCardsRow}>
                      {forcedInfo && (
                        <div
                          className={[
                            styles.assetCard,
                            forcedInfo.missing.length > 0
                              ? styles.assetCardWarn
                              : styles.assetCardOk,
                          ].join(" ")}
                        >
                          <div className={styles.assetCardHeader}>
                            <strong>Zorunlu Hisseler</strong>
                            <span className={styles.assetRatio}>
                              {forcedInfo.inPortfolio}/{forcedInfo.total}
                            </span>
                          </div>
                          <p className={styles.assetSub}>
                            {forcedInfo.codes.join(", ")}
                          </p>
                          <div className={styles.chipRow}>
                            {forcedInfo.codes.map((code) => {
                              const inPortfolio =
                                !forcedInfo.missing.includes(code)
                              return (
                                <span
                                  key={code}
                                  className={[
                                    styles.chip,
                                    inPortfolio
                                      ? styles.chipOk
                                      : styles.chipWarn,
                                  ].join(" ")}
                                >
                                  {code}
                                </span>
                              )
                            })}
                          </div>
                          {forcedInfo.missing.length > 0 && (
                            <p className={styles.assetNote}>
                              ⚠ {forcedInfo.missing.join(", ")} portföyden
                              çıkarılmış.
                            </p>
                          )}
                        </div>
                      )}

                      {excludedInfo && (
                        <div
                          className={[
                            styles.assetCard,
                            excludedInfo.present.length > 0
                              ? styles.assetCardWarn
                              : styles.assetCardOk,
                          ].join(" ")}
                        >
                          <div className={styles.assetCardHeader}>
                            <strong>Hariç Tutulan Hisseler</strong>
                            <span className={styles.assetRatio}>
                              {excludedInfo.removedCount}/{excludedInfo.total}
                            </span>
                          </div>
                          <p className={styles.assetSub}>
                            {excludedInfo.codes.join(", ")}
                          </p>
                          <div className={styles.chipRow}>
                            {excludedInfo.codes.map((code) => {
                              const removed =
                                !excludedInfo.present.includes(code)
                              return (
                                <span
                                  key={code}
                                  className={[
                                    styles.chip,
                                    removed ? styles.chipOk : styles.chipWarn,
                                  ].join(" ")}
                                >
                                  {code}
                                </span>
                              )
                            })}
                          </div>
                          {excludedInfo.present.length > 0 && (
                            <p className={styles.assetNote}>
                              ⚠ {excludedInfo.present.join(", ")} portföye geri
                              eklenmiş.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* ONAY */}
            <div className={styles.confirmCard}>
              <div className={styles.confirmContent}>
                <p className={styles.confirmTitle}>
                  Tüm bilgilerin doğruluğunu onaylıyorum.
                </p>
                <p className={styles.confirmSub}>
                  Onayladıktan sonra fonunuz tamamlanır ve düzenleme
                  yapılamaz.
                </p>
                <label className={styles.confirmCheckRow}>
                  <input
                    type="checkbox"
                    className={styles.confirmCheckbox}
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                  />
                  Yukarıdaki bilgilerin doğru olduğunu kabul ediyorum.
                </label>
              </div>
            </div>

            {hasViolation && (
              <p className={styles.blockedNote}>
                Kural ihlali olduğu için fon onaylanamaz. Önceki adıma dönüp
                portföyü düzeltin.
              </p>
            )}

            {/* FOOTER */}
            <div className={styles.footer}>
              <Button
                variant="link"
                onClick={() => void navigate(`/fund-design/${draftId}/edit`)}
              >
                Geri
              </Button>
              <Button
                onClick={() => void handleComplete()}
                disabled={!canSubmit}
                isLoading={isSaving}
                loadingText="Onaylanıyor..."
              >
                Fon Oluştur
              </Button>
            </div>
          </>
        )}
      </section>
    </FundDesignLayout>
  )
}
