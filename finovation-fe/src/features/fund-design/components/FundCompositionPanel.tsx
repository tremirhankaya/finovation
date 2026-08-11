import { useEffect, useMemo, useState } from "react"

import {
  getWorkingPortfolio,
  type WorkingPortfolioResponse,
} from "@/features/fund-design/api/fundDraftApi"
import DonutChart, {
  DONUT_COLORS,
  type DonutSlice,
} from "@/shared/ui/DonutChart"
import { Tooltip } from "@/shared/ui/Tooltip"
import { FundLoader } from "@/shared/ui/FundLoader"
import styles from "@/features/fund-design/styles/FundCompositionPanel.module.css"

const VISIBLE_HOLDING_COUNT = 5
const OTHER_HOLDINGS_LABEL = "Diğer hisseler"
const TPP_LABEL = "TPP"
const TPP_DESCRIPTION = "Ters repo / para piyasası"
const TPP_COLOR = "#e0a458"
const OTHER_COLOR = "#cbd5e1"

const MAX_STAGGER_STEPS = 12
const STAGGER_STEP_MS = 22

const SECTOR_COLORS = [
  "#0e8f76",
  "#4a90d9",
  "#e0a458",
  "#8b7cf0",
  "#e26d8a",
  "#45b7c8",
  "#6bcb77",
  "#c77dff",
  "#f4c15d",
  "#5c8a9e",
] as const

const UNCLASSIFIED_SECTOR_COLOR = "#cbd5e1"

type FundCompositionPanelProps = {
  draftId: string
  fundName: string
  initialPortfolioSize: number | null
  onNavigate: (path: string) => void
  designMode?: "AI_ASSISTED" | "MANUAL" | null
}

const RELATED_SCREENS = [
  {
    label: "Fon İzleme ve Performans",
    hint: "Getiri ve risk takibi",
    path: "/fund-monitoring",
    icon: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  },
  {
    label: "Fon Optimizasyonu",
    hint: "Ağırlıkları yeniden dengele",
    path: "/optimization-requests/new",
    icon: (
      <>
        <path d="M4 6h10m4 0h2M4 12h4m4 0h10M4 18h13m4 0h1" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="19" cy="18" r="2" />
      </>
    ),
  },
  {
    label: "Stres Testi",
    hint: "Senaryo altında dayanıklılık",
    path: "/stress-test",
    icon: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
        <path d="M4 21h16" />
      </>
    ),
  },
] as const

type Holding = WorkingPortfolioResponse["assets"][number]

function describeHolding(holding: Holding): string {
  const name = holding.display_name?.trim()
  if (name && name !== holding.asset_code) {
    return name
  }
  if (holding.sector_name) {
    return `${holding.asset_code} · ${holding.sector_name}`
  }
  return holding.asset_code
}

function buildSectorColors(holdings: Holding[]): Map<string, string> {
  const sectors = [
    ...new Set(
      holdings
        .map((holding) => holding.sector_name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort()

  return new Map(
    sectors.map((sector, index) => [
      sector,
      SECTOR_COLORS[index % SECTOR_COLORS.length],
    ]),
  )
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`
}

function formatMoney(value: number): string {
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`
}

export default function FundCompositionPanel({
  draftId,
  fundName,
  initialPortfolioSize,
  onNavigate,
  designMode,
}: FundCompositionPanelProps) {
  const [portfolio, setPortfolio] = useState<WorkingPortfolioResponse | null>(
    null,
  )
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [highlightedSliceId, setHighlightedSliceId] = useState<string | null>(
    null,
  )
  const [hoveredAssetCode, setHoveredAssetCode] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      try {
        const loaded = await getWorkingPortfolio(draftId, controller.signal)
        if (controller.signal.aborted) return
        setPortfolio(loaded)
        setError("")
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Portföy bilgisi alınamadı.",
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [draftId])

  const holdings = useMemo(() => {
    if (!portfolio) return []
    return [...portfolio.assets].sort(
      (left, right) => right.weight - left.weight,
    )
  }, [portfolio])

  const weightSlices = useMemo<DonutSlice[]>(() => {
    const equities = holdings.filter(
      (holding) => holding.asset_type === "EQUITY",
    )
    const tppWeight = holdings
      .filter((holding) => holding.asset_type === "TPP")
      .reduce((sum, holding) => sum + holding.weight, 0)

    const slices: DonutSlice[] = equities
      .slice(0, VISIBLE_HOLDING_COUNT)
      .map((holding) => ({
        id: holding.asset_code,
        label: holding.asset_code,
        value: holding.weight,
      }))

    const otherWeight = equities
      .slice(VISIBLE_HOLDING_COUNT)
      .reduce((sum, holding) => sum + holding.weight, 0)

    const otherCount = equities.length - VISIBLE_HOLDING_COUNT

    if (otherWeight > 0) {
      slices.push({
        id: OTHER_HOLDINGS_LABEL,
        label: `${OTHER_HOLDINGS_LABEL} (${otherCount})`,
        value: otherWeight,
        color: OTHER_COLOR,
      })
    }

    if (tppWeight > 0) {
      slices.push({
        id: TPP_LABEL,
        label: TPP_LABEL,
        description: TPP_DESCRIPTION,
        value: tppWeight,
        color: TPP_COLOR,
      })
    }

    return slices
  }, [holdings])

  const sectorColors = useMemo(() => buildSectorColors(holdings), [holdings])

  const sliceIdByAssetCode = useMemo(() => {
    const equities = holdings.filter(
      (holding) => holding.asset_type === "EQUITY",
    )
    const map = new Map<string, string>()
    equities.forEach((holding, index) => {
      map.set(
        holding.asset_code,
        index < VISIBLE_HOLDING_COUNT
          ? holding.asset_code
          : OTHER_HOLDINGS_LABEL,
      )
    })
    holdings
      .filter((holding) => holding.asset_type === "TPP")
      .forEach((holding) => map.set(holding.asset_code, TPP_LABEL))
    return map
  }, [holdings])

  const heaviestWeight = holdings.at(0)?.weight ?? 0

  if (isLoading) {
    return (
      <div className={styles.panel}>
        <FundLoader message="Portföy yükleniyor..." />
      </div>
    )
  }

  if (error || !portfolio) {
    return <p className={styles.status}>{error || "Portföy bulunamadı."}</p>
  }

  return (
    <div className={styles.panel}>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Hisse oranı</dt>
          <dd>{formatPct(portfolio.equityWeightPct)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>TPP oranı</dt>
          <dd>{formatPct(portfolio.tppWeightPct)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Hisse sayısı</dt>
          <dd>{portfolio.stockCount ?? "—"}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Sektör sayısı</dt>
          <dd>{portfolio.sectorCount ?? "—"}</dd>
        </div>
      </dl>

      <div className={styles.content}>
        <section className={styles.allocation}>
          <h4 className={styles.blockTitle}>Ağırlık dağılımı</h4>
          <DonutChart
            slices={weightSlices}
            ariaLabel="Fonun varlık ağırlık dağılımı"
            formatValue={formatPct}
            highlightedSliceId={highlightedSliceId}
            onHighlightChange={setHighlightedSliceId}
          />
          <ul className={styles.legend}>
            {weightSlices.map((slice, index) => (
              <li
                key={slice.id}
                className={[
                  styles.legendItem,
                  highlightedSliceId && highlightedSliceId !== slice.id
                    ? styles.legendItemDimmed
                    : "",
                ].join(" ")}
                onPointerEnter={() => setHighlightedSliceId(slice.id)}
                onPointerLeave={() => setHighlightedSliceId(null)}
              >
                <span
                  className={styles.legendDot}
                  style={{
                    background:
                      slice.color ?? DONUT_COLORS[index % DONUT_COLORS.length],
                  }}
                />
                <span className={styles.legendLabel}>{slice.label}</span>
                <span className={styles.legendValue}>
                  {formatPct(slice.value)}
                </span>
              </li>
            ))}
          </ul>

          <nav className={styles.relatedLinks} aria-label="İlgili ekranlar">
            <h4 className={styles.blockTitle}>Diğer İşlemler</h4>
            {RELATED_SCREENS.map((screen) => (
              <button
                key={screen.path}
                type="button"
                className={styles.relatedTile}
                onClick={() => onNavigate(screen.path)}
              >
                <span className={styles.relatedIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">{screen.icon}</svg>
                </span>
                <span className={styles.relatedText}>
                  <span className={styles.relatedLabel}>{screen.label}</span>
                  <span className={styles.relatedHint}>{screen.hint}</span>
                </span>
              </button>
            ))}
            <div className={styles.relatedDivider} aria-hidden="true" />
            <button
              type="button"
              className={[styles.relatedTile, styles.pdfTile].join(" ")}
              disabled={isDownloadingPdf}
              onClick={async () => {
                if (isDownloadingPdf) return
                setIsDownloadingPdf(true)
                try {
                  const { downloadFundSummaryPdf } = await import(
                    "@/features/fund-design/lib/fundSummaryPdf"
                  )
                  await downloadFundSummaryPdf({
                    fundName,
                    initialPortfolioSize,
                    portfolio,
                  })
                } finally {
                  setIsDownloadingPdf(false)
                }
              }}
            >
              <span className={styles.relatedIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                </svg>
              </span>
              <span className={styles.relatedText}>
                <span className={styles.relatedLabel}>
                  {isDownloadingPdf ? "PDF hazırlanıyor…" : "Fon özetini PDF indir"}
                </span>
                <span className={styles.relatedHint}>
                  Portföy dağılımı ve varlık ağırlıkları
                </span>
              </span>
            </button>
          </nav>
        </section>

        <section className={styles.holdings}>
          <h4 className={styles.blockTitle}>
            Portföy içeriği
            <span className={styles.blockCount}>{holdings.length} varlık</span>
          </h4>
          <ul className={styles.holdingList}>
            {holdings.map((holding, index) => {
              const sliceId = sliceIdByAssetCode.get(holding.asset_code)
              let isDimmed = false
              if (hoveredAssetCode) {
                isDimmed = hoveredAssetCode !== holding.asset_code
              } else if (highlightedSliceId) {
                isDimmed = highlightedSliceId !== sliceId
              }

              const sectorColor = holding.sector_name
                ? (sectorColors.get(holding.sector_name) ??
                  UNCLASSIFIED_SECTOR_COLOR)
                : UNCLASSIFIED_SECTOR_COLOR

              const mainContent = (
                <div className={styles.holdingMain}>
                  <span
                    className={styles.sectorDot}
                    style={{ background: sectorColor }}
                    title={holding.sector_name ?? "Sektör tanımsız"}
                  />
                  <span
                    className={styles.holdingCode}
                    title={
                      !holding.ai_note || designMode !== "AI_ASSISTED"
                        ? describeHolding(holding)
                        : undefined
                    }
                  >
                    {holding.ai_note && designMode === "AI_ASSISTED" ? (
                      <span className={styles.holdingCodeHoverable}>
                        {holding.asset_code}
                      </span>
                    ) : (
                      holding.asset_code
                    )}
                  </span>
                  <span className={styles.holdingTrack}>
                    <span
                      className={[
                        styles.holdingFill,
                        holding.asset_type === "TPP"
                          ? styles.holdingFillTpp
                          : "",
                      ].join(" ")}
                      style={{
                        width:
                          heaviestWeight > 0
                            ? `${(holding.weight / heaviestWeight) * 100}%`
                            : "0%",
                        animationDelay: `${
                          Math.min(index, MAX_STAGGER_STEPS) * STAGGER_STEP_MS
                        }ms`,
                      }}
                    />
                  </span>
                  <span className={styles.holdingWeight}>
                    {formatPct(holding.weight)}
                  </span>
                  {initialPortfolioSize != null && (
                    <span className={styles.holdingAmount}>
                      {formatMoney(
                        (initialPortfolioSize * holding.weight) / 100,
                      )}
                    </span>
                  )}
                </div>
              )

              return (
                <li
                  key={holding.asset_code}
                  className={[
                    styles.holding,
                    isDimmed ? styles.holdingDimmed : "",
                  ].join(" ")}
                  onPointerEnter={() => {
                    setHighlightedSliceId(sliceId ?? null)
                    setHoveredAssetCode(holding.asset_code)
                  }}
                  onPointerLeave={() => {
                    setHighlightedSliceId(null)
                    setHoveredAssetCode(null)
                  }}
                >
                  {holding.ai_note && designMode === "AI_ASSISTED" ? (
                    <Tooltip
                      content={holding.ai_note}
                      position="top"
                      fullWidth
                      forceVisible={
                        highlightedSliceId === sliceId &&
                        !hoveredAssetCode &&
                        sliceId !== OTHER_HOLDINGS_LABEL
                      }
                    >
                      {mainContent}
                    </Tooltip>
                  ) : (
                    mainContent
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
