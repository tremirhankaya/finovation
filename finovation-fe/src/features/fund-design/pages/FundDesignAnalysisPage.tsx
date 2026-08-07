import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"

import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import ProspectusRulesPanel from "@/features/fund-design/components/ProspectusRulesPanel"
import {
  getFundDraft,
  getFundDraftAnalysisState,
  runFundDraftAnalysis,
} from "@/features/fund-design/api/fundDraftApi"
import { buildRulesFingerprint } from "@/features/fund-design/lib/rulesFingerprint"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import {
  getManagementApproach,
  type ManagementApproachCode,
} from "@/features/fund-design/model/managementApproach"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundDesignAnalysisPage.module.css"

const ANALYSIS_STAGES = [
  "Piyasa verileri toplanıyor",
  "Veriler temizleniyor",
  "Fırsatlar değerlendiriliyor",
  "Optimizasyon yapılıyor",
  "Alternatifler oluşturuluyor",
] as const

const STAGE_INTERVAL_MS = 1600

type StrategyPrefs = {
  approach: ManagementApproachCode | null
  tppMinPct: number | null
  tppMaxPct: number | null
  preferredTppPct: number | null
  minStockCount: number | null
  maxStockCount: number | null
  equityMinPct: number | null
  equityMaxPct: number | null
  singleStockMaxPct: number | null
  fundName: string | null
  excludedAssetCodes: string[]
  forcedAssetCodes: string[]
}

const EMPTY_PREFS: StrategyPrefs = {
  approach: null,
  tppMinPct: null,
  tppMaxPct: null,
  preferredTppPct: null,
  minStockCount: null,
  maxStockCount: null,
  equityMinPct: null,
  equityMaxPct: null,
  singleStockMaxPct: null,
  fundName: null,
  excludedAssetCodes: [],
  forcedAssetCodes: [],
}

function formatAnalysisDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `%${value}`
}

function formatPctRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null || max == null) return "—"
  return `%${min} – %${max}`
}

function formatCountRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null || max == null) return "—"
  return `${min} – ${max}`
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ActiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 2 4 14h7l-1 8 10-14h-7l1-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type StageStatus = "done" | "active" | "pending"

function stageStatus(index: number, activeIndex: number, complete: boolean): StageStatus {
  if (complete || index < activeIndex) return "done"
  if (index === activeIndex) return "active"
  return "pending"
}

function progressPercent(activeIndex: number, complete: boolean): number {
  if (complete) return 100
  const raw = ((activeIndex + 0.55) / ANALYSIS_STAGES.length) * 100
  return Math.min(92, Math.max(8, Math.round(raw)))
}

type PrefTileProps = {
  label: string
  value: string
  hint?: string
  locked?: boolean
}

function PrefTile({ label, value, hint, locked = false }: PrefTileProps) {
  return (
    <div
      className={[styles.prefTile, locked ? styles.prefTileLocked : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <p className={styles.prefLabel}>{label}</p>
      <p className={styles.prefValue}>{value}</p>
      {hint ? <p className={styles.prefHint}>{hint}</p> : null}
    </div>
  )
}

export default function FundDesignAnalysisPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const { init, error: initError, reload: reloadInit } = useFundDraftInit({
    page: "ANALYSIS",
  })

  const [formError, setFormError] = useState("")
  const [prefs, setPrefs] = useState<StrategyPrefs>(EMPTY_PREFS)
  const [analysisDate] = useState(() => new Date())
  const [activeStageIndex, setActiveStageIndex] = useState(0)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const finishedRef = useRef(false)

  const rulesFingerprint = useMemo(
    () =>
      buildRulesFingerprint({
        managementApproach: prefs.approach,
        tppMinPct: prefs.tppMinPct,
        tppMaxPct: prefs.tppMaxPct,
        preferredTppPct: prefs.preferredTppPct,
        minStockCount: prefs.minStockCount,
        maxStockCount: prefs.maxStockCount,
        excludedAssetCodes: prefs.excludedAssetCodes,
        forcedAssetCodes: prefs.forcedAssetCodes,
      }),
    [prefs],
  )

  useEffect(() => {
    if (!draftId) return
    const controller = new AbortController()

    async function hydrate() {
      try {
        const draft = await getFundDraft(draftId!, controller.signal)
        if (controller.signal.aborted) return

        setPrefs({
          approach: draft.managementApproach ?? null,
          tppMinPct: draft.tppMinPct ?? null,
          tppMaxPct: draft.tppMaxPct ?? null,
          preferredTppPct: draft.preferredTppPct ?? null,
          minStockCount: draft.minStockCount ?? null,
          maxStockCount: draft.maxStockCount ?? null,
          equityMinPct: draft.equityMinPct ?? null,
          equityMaxPct: draft.equityMaxPct ?? null,
          singleStockMaxPct: draft.singleStockMaxPct ?? null,
          fundName: draft.name?.trim() || null,
          excludedAssetCodes: draft.excludedAssetCodes ?? [],
          forcedAssetCodes: draft.forcedAssetCodes ?? [],
        })
        setIsReady(true)
      } catch (error) {
        if (controller.signal.aborted) return
        setFormError(
          error instanceof Error ? error.message : "Fon taslağı alınamadı",
        )
        setIsReady(true)
      }
    }

    void hydrate()
    return () => controller.abort()
  }, [draftId])

  useEffect(() => {
    if (!isReady || !draftId || analysisComplete || formError) return
    if (!prefs.approach) return

    finishedRef.current = false

    function finish() {
      if (finishedRef.current) return
      finishedRef.current = true
      setActiveStageIndex(ANALYSIS_STAGES.length)
      setAnalysisComplete(true)
    }

    const controller = new AbortController()

    const stageTimer = window.setInterval(() => {
      setActiveStageIndex((current) => {
        if (finishedRef.current) return ANALYSIS_STAGES.length
        if (current >= ANALYSIS_STAGES.length - 1) return current
        return current + 1
      })
    }, STAGE_INTERVAL_MS)

    void (async () => {
      try {
        const existing = await getFundDraftAnalysisState(
          draftId!,
          controller.signal,
        )
        if (controller.signal.aborted) return

        if (existing.proposals.length > 0) {
          finish()
          return
        }

        await runFundDraftAnalysis(draftId!, controller.signal)
        if (controller.signal.aborted) return
        finish()
      } catch (error) {
        if (controller.signal.aborted) return
        finishedRef.current = true
        setFormError(
          error instanceof Error ? error.message : "AI analizi başarısız oldu",
        )
      }
    })()

    return () => {
      controller.abort()
      window.clearInterval(stageTimer)
    }
  }, [
    isReady,
    draftId,
    analysisComplete,
    formError,
    prefs.approach,
    rulesFingerprint,
  ])

  const approachLabel = prefs.approach
    ? getManagementApproach(prefs.approach).label
    : "—"

  const equityMin = prefs.equityMinPct ?? init?.minEquityWeightPct ?? null
  const equityMax = prefs.equityMaxPct ?? init?.maxEquityWeightPct ?? null
  const singleStockMax =
    prefs.singleStockMaxPct ?? init?.maxSingleStockMaxPct ?? null
  const singleStockMin = init?.minSingleStockMaxPct ?? null
  const sectorMax =
    init?.sectorMaxPct != null ? Math.round(init.sectorMaxPct) : null

  const tppValue =
    prefs.tppMinPct != null && prefs.tppMaxPct != null
      ? formatPctRange(prefs.tppMinPct, prefs.tppMaxPct)
      : "—"
  const tppHint =
    prefs.preferredTppPct != null
      ? `Hedef ${formatPct(prefs.preferredTppPct)}`
      : undefined

  const progress = progressPercent(activeStageIndex, analysisComplete)

  return (
    <FundDesignLayout step={3}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>3. AI Analizi</h2>
          <p className={styles.introLead}>Strateji tercihlerine göre model çalışıyor</p>
          <p className={styles.intro}>
            Kaydettiğiniz portföy kuralları modele iletiliyor; analiz bitince
            alternatif önerilere geçebilirsiniz.
          </p>
        </header>

        {formError ? <FormAlert>{formError}</FormAlert> : null}
        {initError ? (
          <FormAlert>
            {initError}
            <button className={styles.retry} type="button" onClick={reloadInit}>
              Tekrar dene
            </button>
          </FormAlert>
        ) : null}

        <div className={styles.grid}>
          <div className={styles.mainColumn}>
            <section className={styles.card} aria-label="AI analiz durumu">
              <div className={styles.analysisGrid}>
                <div className={styles.stagesColumn}>
                  <h3 className={styles.columnTitle}>Analiz Aşaması</h3>
                  <ol className={styles.stageList}>
                    {ANALYSIS_STAGES.map((label, index) => {
                      const status = stageStatus(
                        index,
                        activeStageIndex,
                        analysisComplete,
                      )
                      return (
                        <li
                          key={label}
                          className={[
                            styles.stageItem,
                            status === "done" ? styles.stageDone : "",
                            status === "active" ? styles.stageActive : "",
                            status === "pending" ? styles.stagePending : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span className={styles.stageIcon} aria-hidden="true">
                            {status === "done" ? (
                              <CheckIcon />
                            ) : status === "active" ? (
                              <ActiveIcon />
                            ) : null}
                          </span>
                          <span className={styles.stageLabel}>{label}</span>
                        </li>
                      )
                    })}
                  </ol>
                </div>

                <div className={styles.detailsColumn}>
                  <div className={styles.detailsHeader}>
                    <h3 className={styles.columnTitle}>Kullanılan Tercihler</h3>
                    {prefs.fundName ? (
                      <p className={styles.fundMeta}>
                        <span className={styles.fundName}>{prefs.fundName}</span>
                        <span className={styles.metaDot} aria-hidden="true">
                          ·
                        </span>
                        <span>{formatAnalysisDate(analysisDate)}</span>
                      </p>
                    ) : (
                      <p className={styles.fundMeta}>
                        {formatAnalysisDate(analysisDate)}
                      </p>
                    )}
                  </div>

                  <div className={styles.prefGrid} aria-label="Strateji tercihleri">
                    <PrefTile label="Yönetim Yaklaşımı" value={approachLabel} />
                    <PrefTile label="TPP Aralığı" value={tppValue} hint={tppHint} />
                    <PrefTile
                      label="Hisse Sayısı"
                      value={formatCountRange(
                        prefs.minStockCount,
                        prefs.maxStockCount,
                      )}
                    />
                    {prefs.forcedAssetCodes.length > 0 ? (
                      <PrefTile
                        label="Zorunlu Hisseler"
                        value={prefs.forcedAssetCodes.join(", ")}
                      />
                    ) : null}
                    {prefs.excludedAssetCodes.length > 0 ? (
                      <PrefTile
                        label="Hariç Tutulanlar"
                        value={prefs.excludedAssetCodes.join(", ")}
                      />
                    ) : null}
                  </div>

                  <p className={styles.lockedHeading}>İzahname kısıtları</p>
                  <div
                    className={styles.prefGrid}
                    aria-label="Değiştirilemez izahname kısıtları"
                  >
                    <PrefTile
                      locked
                      label="Hisse Senedi Oranı"
                      value={formatPctRange(equityMin, equityMax)}
                    />
                    <PrefTile
                      locked
                      label="Tek Hisse Ağırlığı"
                      value={
                        singleStockMin != null && singleStockMax != null
                          ? formatPctRange(singleStockMin, singleStockMax)
                          : formatPct(singleStockMax)
                      }
                    />
                    <PrefTile
                      locked
                      label="Sektör (Maks.)"
                      value={sectorMax != null ? `%${sectorMax}` : "—"}
                      hint="Değiştirilemez"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.progressBlock}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>İlerleme</span>
                  <span className={styles.progressValue}>%{progress}</span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Analiz ilerlemesi"
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className={styles.progressNote}>
                  {analysisComplete
                    ? "Analiz tamamlandı. Alternatifleri görüntülemek için İleri’ye geçin."
                    : "Model çalışıyor; tercihler salt okunur."}
                </p>
              </div>
            </section>

            <div className={styles.actions}>
              <button
                className={styles.back}
                type="button"
                onClick={() => {
                  if (!draftId) return
                  void navigate(`/fund-design/${draftId}/strategy`)
                }}
              >
                ← Geri
              </button>
              <Button
                className={styles.continue}
                type="button"
                disabled={!analysisComplete || !draftId}
                onClick={() => {
                  if (!draftId) return
                  void navigate(`/fund-design/${draftId}/alternatives`)
                }}
              >
                İleri →
              </Button>
            </div>
          </div>

          <ProspectusRulesPanel init={init} />
        </div>
      </section>
    </FundDesignLayout>
  )
}
