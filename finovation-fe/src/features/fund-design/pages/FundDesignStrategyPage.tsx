import { useEffect, useRef, useState, type ComponentType } from "react"
import { useNavigate, useParams } from "react-router"

import DualRangeSlider from "@/features/fund-design/components/DualRangeSlider"
import AssetPreferencePicker from "@/features/fund-design/components/AssetPreferencePicker"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import FundDesignProgressRail from "@/features/fund-design/components/FundDesignProgressRail"
import ParamInfoTip from "@/features/fund-design/components/ParamInfoTip"
import ProspectusRulesPanel from "@/features/fund-design/components/ProspectusRulesPanel"
import {
  updateFundDraftPortfolioRules,
  type UpdateFundDraftPortfolioRulesInput,
} from "@/features/fund-design/api/fundDraftApi"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import { buildRulesFingerprint } from "@/features/fund-design/lib/rulesFingerprint"
import type { FundDraft } from "@/features/fund-design/model/fundDraftSchemas"
import {
  type ManagementApproachCode,
  MANAGEMENT_APPROACHES,
  clampRange,
  clampToRange,
  getManagementApproach,
} from "@/features/fund-design/model/managementApproach"
import { getFundDraftPortfolioRulesUrl } from "@/shared/api/apiConfig"
import { getAccessToken } from "@/shared/auth/authStorage"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundDesignStrategyPage.module.css"

function AttackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  )
}

function BalancedIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4v16M5 9h14M7.5 9 5 14h5M16.5 9 19 14h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProtectiveIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.5 19 7v5.2c0 4.2-2.8 7.4-7 8.8-4.2-1.4-7-4.6-7-8.8V7l7-3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CustomIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

const APPROACH_ICONS: Record<ManagementApproachCode, ComponentType> = {
  ATTACK: AttackIcon,
  BALANCED: BalancedIcon,
  PROTECTIVE: ProtectiveIcon,
  CUSTOM: CustomIcon,
}

const SAVE_ERROR_FALLBACK = "Portföy kuralları kaydedilemedi"
const AUTOSAVE_DELAY_MS = 800

function hasSavedPortfolioRules(draft: FundDraft): boolean {
  return (
    draft.managementApproach != null &&
    draft.tppMinPct != null &&
    draft.tppMaxPct != null &&
    draft.preferredTppPct != null &&
    draft.minStockCount != null &&
    draft.maxStockCount != null
  )
}

function flushPortfolioRulesKeepalive(
  draftId: string,
  payload: UpdateFundDraftPortfolioRulesInput,
): void {
  const accessToken = getAccessToken()
  if (!accessToken) return

  try {
    void fetch(getFundDraftPortfolioRulesUrl(draftId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {}
}

export default function FundDesignStrategyPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const {
    init,
    error: initError,
    isLoading,
    reload: reloadInit,
  } = useFundDraftInit({ page: "STRATEGY", draftId })

  const [approach, setApproach] = useState<ManagementApproachCode>("ATTACK")
  const [liquidityMinPct, setLiquidityMinPct] = useState(10)
  const [liquidityMaxPct, setLiquidityMaxPct] = useState(14)
  const [preferredLiquidityPct, setPreferredLiquidityPct] = useState(12)
  const [minStockCount, setMinStockCount] = useState(16)
  const [maxStockCount, setMaxStockCount] = useState(21)
  const [forcedAssetCodes, setForcedAssetCodes] = useState<string[]>([])
  const [excludedAssetCodes, setExcludedAssetCodes] = useState<string[]>([])
  const [isReady, setIsReady] = useState(false)
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const skipAutosaveRef = useRef(true)
  const isDirtyRef = useRef(false)
  const saveRequestIdRef = useRef(0)
  const lastPersistedFingerprintRef = useRef<string | null>(null)
  const latestPayloadRef = useRef<UpdateFundDraftPortfolioRulesInput>({
    managementApproach: "ATTACK",
    tppMinPct: 10,
    tppMaxPct: 14,
    preferredTppPct: 12,
    minStockCount: 16,
    maxStockCount: 21,
    excludedAssetCodes: [],
    forcedAssetCodes: [],
  })

  useEffect(() => {
    setIsReady(false)
    skipAutosaveRef.current = true
    isDirtyRef.current = false
    setFormError("")
  }, [draftId])

  useEffect(() => {
    latestPayloadRef.current = {
      managementApproach: approach,
      tppMinPct: liquidityMinPct,
      tppMaxPct: liquidityMaxPct,
      preferredTppPct: preferredLiquidityPct,
      minStockCount,
      maxStockCount,
      excludedAssetCodes,
      forcedAssetCodes,
    }
  }, [
    approach,
    liquidityMinPct,
    liquidityMaxPct,
    preferredLiquidityPct,
    minStockCount,
    maxStockCount,
    excludedAssetCodes,
    forcedAssetCodes,
  ])

  function markDirty() {
    isDirtyRef.current = true
  }

  function applyValues(input: {
    approach: ManagementApproachCode
    liquidityMinPct: number
    liquidityMaxPct: number
    preferredLiquidityPct: number
    minStockCount: number
    maxStockCount: number
    excludedAssetCodes?: string[]
    forcedAssetCodes?: string[]
  }) {
    setApproach(input.approach)
    setLiquidityMinPct(input.liquidityMinPct)
    setLiquidityMaxPct(input.liquidityMaxPct)
    setPreferredLiquidityPct(input.preferredLiquidityPct)
    setMinStockCount(input.minStockCount)
    setMaxStockCount(input.maxStockCount)
    const excluded = input.excludedAssetCodes ?? []
    const forced = input.forcedAssetCodes ?? []
    setExcludedAssetCodes(excluded)
    setForcedAssetCodes(forced)
    latestPayloadRef.current = {
      managementApproach: input.approach,
      tppMinPct: input.liquidityMinPct,
      tppMaxPct: input.liquidityMaxPct,
      preferredTppPct: input.preferredLiquidityPct,
      minStockCount: input.minStockCount,
      maxStockCount: input.maxStockCount,
      excludedAssetCodes: excluded,
      forcedAssetCodes: forced,
    }
  }

  function applyApproachDefaults(code: ManagementApproachCode) {
    if (!init) return

    const defaults = getManagementApproach(code)
    const liquidity = clampRange(
      defaults.defaultLiquidityMinPct,
      defaults.defaultLiquidityMaxPct,
      init.minLiquidityTargetPct,
      init.maxLiquidityTargetPct,
      init.minTppRangePct,
    )
    const stocks = clampRange(
      defaults.defaultMinStockCount,
      defaults.defaultMaxStockCount,
      init.minStockCount,
      init.maxStockCount,
      init.minStockCountRange,
    )

    applyValues({
      approach: code,
      liquidityMinPct: liquidity.min,
      liquidityMaxPct: liquidity.max,
      preferredLiquidityPct: clampToRange(
        defaults.defaultPreferredLiquidityPct,
        liquidity.min,
        liquidity.max,
      ),
      minStockCount: stocks.min,
      maxStockCount: stocks.max,
      excludedAssetCodes,
      forcedAssetCodes: forcedAssetCodes.slice(
        0,
        Math.min(init.maxAssetPreferences, stocks.min),
      ),
    })
  }

  useEffect(() => {
    if (!init || init.page !== "STRATEGY" || !draftId || isReady) return

    const draft = init.draft
    const serverSaved = hasSavedPortfolioRules(draft)

    if (serverSaved) {
      applyValues({
        approach: draft.managementApproach!,
        liquidityMinPct: draft.tppMinPct!,
        liquidityMaxPct: draft.tppMaxPct!,
        preferredLiquidityPct: draft.preferredTppPct!,
        minStockCount: draft.minStockCount!,
        maxStockCount: draft.maxStockCount!,
        excludedAssetCodes: draft.excludedAssetCodes ?? [],
        forcedAssetCodes: draft.forcedAssetCodes ?? [],
      })
      lastPersistedFingerprintRef.current = buildRulesFingerprint({
        managementApproach: draft.managementApproach,
        tppMinPct: draft.tppMinPct,
        tppMaxPct: draft.tppMaxPct,
        preferredTppPct: draft.preferredTppPct,
        minStockCount: draft.minStockCount,
        maxStockCount: draft.maxStockCount,
        excludedAssetCodes: draft.excludedAssetCodes ?? [],
        forcedAssetCodes: draft.forcedAssetCodes ?? [],
      })
      isDirtyRef.current = false
      skipAutosaveRef.current = true
      setIsReady(true)
      return
    }

    applyApproachDefaults("ATTACK")
    isDirtyRef.current = false
    skipAutosaveRef.current = true
    setIsReady(true)
  }, [init, draftId, isReady])

  async function persistPortfolioRules(options?: {
    navigateOnSuccess?: string
    silent?: boolean
  }) {
    if (!draftId || !init) return false

    const requestId = ++saveRequestIdRef.current
    const payload = latestPayloadRef.current

    try {
      await updateFundDraftPortfolioRules(draftId, payload)
      if (requestId !== saveRequestIdRef.current) return false
      lastPersistedFingerprintRef.current = buildRulesFingerprint(payload)
      isDirtyRef.current = false
      if (options?.navigateOnSuccess) {
        await navigate(options.navigateOnSuccess)
      }
      return true
    } catch (error) {
      if (requestId !== saveRequestIdRef.current) return false
      isDirtyRef.current = true
      if (!options?.silent) {
        setFormError(
          error instanceof Error ? error.message : SAVE_ERROR_FALLBACK,
        )
      }
      return false
    }
  }

  useEffect(() => {
    if (!isReady || !draftId || !init || isSubmitting) return
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
      return
    }

    markDirty()

    const timer = window.setTimeout(() => {
      void persistPortfolioRules({ silent: true })
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [
    approach,
    liquidityMinPct,
    liquidityMaxPct,
    preferredLiquidityPct,
    minStockCount,
    maxStockCount,
    excludedAssetCodes,
    forcedAssetCodes,
    isReady,
    draftId,
    init,
    isSubmitting,
  ])

  useEffect(() => {
    function flushOnLeave() {
      if (!isReady || !draftId || !isDirtyRef.current) return
      flushPortfolioRulesKeepalive(draftId, latestPayloadRef.current)
    }

    window.addEventListener("pagehide", flushOnLeave)
    return () => window.removeEventListener("pagehide", flushOnLeave)
  }, [isReady, draftId])

  function handleApproachSelect(code: ManagementApproachCode) {
    markDirty()
    applyApproachDefaults(code)
  }

  function handleLiquidityRangeChange(next: { min: number; max: number }) {
    markDirty()
    setLiquidityMinPct(next.min)
    setLiquidityMaxPct(next.max)
    setPreferredLiquidityPct((current) => {
      if (current >= next.min && current <= next.max) return current
      return clampToRange(current, next.min, next.max)
    })
  }

  async function handleBack() {
    if (isReady && draftId && init) {
      setFormError("")
      await persistPortfolioRules()
    }
    await navigate("/fund-design")
  }

  async function handleContinue() {
    if (!draftId || !init || isSubmitting) return

    setFormError("")
    setIsSubmitting(true)
    await persistPortfolioRules({
      navigateOnSuccess: `/fund-design/${draftId}/analysis`,
    })
    setIsSubmitting(false)
  }

  const selectedApproach = getManagementApproach(approach)
  const sectorMaxPct = init ? Math.round(init.sectorMaxPct) : 30
  const canContinue = Boolean(init && draftId && isReady) && !isSubmitting
  const liquidityBoundMin = init?.minLiquidityTargetPct ?? 5
  const liquidityBoundMax = init?.maxLiquidityTargetPct ?? 15
  const stockBoundMin = init?.minStockCount ?? 16
  const stockBoundMax = init?.maxStockCount ?? 36
  const liquidityGap = init?.minTppRangePct ?? 3
  const stockGap = init?.minStockCountRange ?? 5

  return (
    <FundDesignLayout step={2} isLoading={isLoading}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>Portföy Kuralları</h2>
          <p className={styles.introLead}>Strateji ve Portföy Kuralları</p>
          <p className={styles.intro}>
            Fonun yönetim yaklaşımını seçin, likidite ve hisse sayısı aralığını
            belirleyin. İsterseniz zorunlu veya hariç tutulacak hisseleri
            seçebilirsiniz. Sektör üst limiti izahname gereği sabittir.
          </p>
        </header>

        {formError && <FormAlert>{formError}</FormAlert>}
        {initError && (
          <FormAlert>
            {initError}
            <button className={styles.retry} type="button" onClick={reloadInit}>
              Tekrar dene
            </button>
          </FormAlert>
        )}

        <div className={styles.grid}>
          <div className={styles.mainColumn}>
            <section className={styles.card} aria-labelledby="approach-title">
              <h3 id="approach-title" className={styles.blockTitle}>
                1. Yönetim Yaklaşımı
              </h3>
              <div
                className={styles.approachGrid}
                role="radiogroup"
                aria-label="Yönetim yaklaşımı"
              >
                {MANAGEMENT_APPROACHES.filter(
                  (option) => option.code !== "CUSTOM",
                ).map((option) => {
                  const Icon = APPROACH_ICONS[option.code]
                  const selected = option.code === approach

                  return (
                    <button
                      key={option.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={[
                        styles.approachCard,
                        selected && styles.approachCardSelected,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleApproachSelect(option.code)}
                    >
                      <span className={styles.approachIcon}>
                        <Icon />
                      </span>
                      <p className={styles.approachLabel}>{option.label}</p>
                      <p className={styles.approachText}>
                        {option.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={styles.card} aria-labelledby="params-title">
              <h3 id="params-title" className={styles.blockTitle}>
                2. Portföy Parametreleri
              </h3>

              <div className={styles.paramList}>
                <div className={styles.paramField}>
                  <div className={styles.paramHeading}>
                    <span className={styles.paramLabel} id="liquidity-label">
                      Hedef Likidite Oranı (TPP)
                    </span>
                    <div className={styles.paramHeadingActions}>
                      <ParamInfoTip label="Hedef Likidite Oranı">
                        Bu aralık, portföyün Takas Para Piyasası (TPP) gibi
                        likit varlıklarda tutacağı payı belirler. Daha yüksek
                        oran, nakde dönüş esnekliğini artırır; daha düşük oran
                        ise hisse senetleri için daha fazla alan bırakır.
                      </ParamInfoTip>
                      <button
                        type="button"
                        className={styles.resetDefaults}
                        disabled={!init}
                        onClick={() => applyApproachDefaults(approach)}
                      >
                        Varsayılana dön
                      </button>
                    </div>
                  </div>
                  <p className={styles.paramCaption}>
                    {selectedApproach.label}: %
                    {selectedApproach.defaultLiquidityMinPct}
                    –%{selectedApproach.defaultLiquidityMaxPct}
                  </p>
                  <DualRangeSlider
                    id="liquidity"
                    min={liquidityBoundMin}
                    max={liquidityBoundMax}
                    valueMin={liquidityMinPct}
                    valueMax={liquidityMaxPct}
                    minGap={liquidityGap}
                    disabled={!init}
                    inputPrefix="%"
                    formatBound={(value) => `%${value}`}
                    onChange={handleLiquidityRangeChange}
                  />
                </div>

                <div className={styles.paramField}>
                  <div className={styles.paramHeading}>
                    <span className={styles.paramLabel} id="stock-label">
                      Hisse Sayısı
                    </span>
                    <ParamInfoTip label="Hisse Sayısı">
                      Bu aralık, portföyde yer alacak hisse adedini belirler.
                      Daha fazla hisse çeşitlendirmeyi artırabilir; daha az
                      hisse ise seçilen hisselerin portföy üzerindeki etkisini
                      yükseltir. Seçiminiz izahname sınırları içinde kalır.
                    </ParamInfoTip>
                  </div>
                  <p className={styles.paramCaption}>
                    {selectedApproach.label}:{" "}
                    {selectedApproach.defaultMinStockCount}–
                    {selectedApproach.defaultMaxStockCount}
                  </p>
                  <DualRangeSlider
                    id="stock-count"
                    min={stockBoundMin}
                    max={stockBoundMax}
                    valueMin={minStockCount}
                    valueMax={maxStockCount}
                    minGap={stockGap}
                    disabled={!init}
                    onChange={({ min, max }) => {
                      markDirty()
                      setMinStockCount(min)
                      setMaxStockCount(max)
                      setForcedAssetCodes((current) =>
                        current.slice(
                          0,
                          Math.min(init?.maxAssetPreferences ?? 3, min),
                        ),
                      )
                    }}
                  />
                </div>

                <div className={styles.paramField}>
                  <div className={styles.paramHeading}>
                    <span className={styles.paramLabel}>
                      Sektör Ağırlığı Üst Limiti
                    </span>
                    <ParamInfoTip label="Sektör Ağırlığı Üst Limiti">
                      Tek bir sektöre ayrılabilecek en yüksek portföy payıdır.
                      Sektör yoğunlaşması riskini sınırlamak için izahname
                      tarafından sabitlenir; bu nedenle bu ekrandan
                      değiştirilemez.
                    </ParamInfoTip>
                  </div>
                  <p className={styles.paramCaption}>
                    İzahname gereği sabit — değiştirilemez
                  </p>
                  <div className={styles.readonlyField} aria-readonly="true">
                    %{sectorMaxPct}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.card} aria-labelledby="prefs-title">
              <h3 id="prefs-title" className={styles.blockTitle}>
                3. Hisse Tercihleri
              </h3>
              <AssetPreferencePicker
                forcedCodes={forcedAssetCodes}
                excludedCodes={excludedAssetCodes}
                minStockCount={minStockCount}
                maxAssetPreferences={init?.maxAssetPreferences ?? 3}
                universe={init?.page === "STRATEGY" ? init.modelUniverse : []}
                sectors={init?.page === "STRATEGY" ? init.modelUniverseSectors : []}
                disabled={!init || !isReady}
                onForcedChange={(codes) => {
                  markDirty()
                  setForcedAssetCodes(codes)
                }}
                onExcludedChange={(codes) => {
                  markDirty()
                  setExcludedAssetCodes(codes)
                }}
              />
            </section>

            <div className={styles.actions}>
              <button
                className={styles.back}
                type="button"
                onClick={() => void handleBack()}
              >
                ← Geri
              </button>
              <Button
                className={styles.continue}
                type="button"
                disabled={!canContinue}
                isLoading={isSubmitting}
                loadingText="Kaydediliyor…"
                onClick={() => void handleContinue()}
              >
                İleri →
              </Button>
            </div>
          </div>

          <aside className={styles.sideColumn}>
            <ProspectusRulesPanel init={init} />
            <FundDesignProgressRail currentStep={2} />
          </aside>
        </div>
      </section>
    </FundDesignLayout>
  )
}
