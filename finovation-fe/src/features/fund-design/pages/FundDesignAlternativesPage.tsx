import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"

import {
  getFundDraftAnalysisState,
  runFundDraftAnalysis,
  selectFundDraftProposal,
  type FundModelProposal,
} from "@/features/fund-design/api/fundDraftApi"
import FundDesignLayout from "@/features/fund-design/components/FundDesignLayout"
import ProspectusRulesPanel from "@/features/fund-design/components/ProspectusRulesPanel"
import { useFundDraftInit } from "@/features/fund-design/hooks/useFundDraftInit"
import {
  summarizeProposal,
  type HoldingSlice,
  type ProposalSummary,
} from "@/features/fund-design/lib/proposalSummary"
import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/fund-design/styles/FundDesignAlternativesPage.module.css"

const CHART_COLORS = [
  "#2ec4a7",
  "#4a90d9",
  "#f0a05a",
  "#8b7cf0",
  "#e26d8a",
  "#45b7c8",
  "#f4c15d",
  "#6bcb77",
  "#c77dff",
  "#ff6b6b",
  "#4ecdc4",
  "#ffa94d",
  "#748ffc",
  "#69db7c",
  "#ff8787",
  "#3bc9db",
  "#b197fc",
  "#fcc419",
  "#20c997",
  "#339af0",
  "#ff922b",
  "#845ef7",
  "#f06595",
  "#15aabf",
  "#1e3a5f",
]

function colorForIndex(index: number, code: string): string {
  if (code === "TPP" || code.toUpperCase().startsWith("TPP")) {
    return "#1e3a5f"
  }
  return CHART_COLORS[index % (CHART_COLORS.length - 1)]
}

type ViewMode = "pie" | "table"

type SliceMeta = HoldingSlice & {
  color: string
  startAngle: number
  endAngle: number
}

function formatPct(value: number): string {
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}`
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.max(0.01, endAngle - startAngle)
  const end = startAngle + sweep
  const largeArc = sweep > 180 ? 1 : 0
  const o1 = polar(cx, cy, outerR, startAngle)
  const o2 = polar(cx, cy, outerR, end)
  const i1 = polar(cx, cy, innerR, end)
  const i2 = polar(cx, cy, innerR, startAngle)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ")
}

function buildSliceMeta(slices: HoldingSlice[]): SliceMeta[] {
  const total = slices.reduce((sum, slice) => sum + slice.weightPct, 0) || 1
  let cursor = 0
  return slices.map((slice, index) => {
    const span = (slice.weightPct / total) * 360
    const startAngle = cursor
    const endAngle = cursor + span
    cursor = endAngle
    return {
      ...slice,
      color: colorForIndex(index, slice.code),
      startAngle,
      endAngle,
    }
  })
}

type InteractivePieProps = {
  slices: HoldingSlice[]
  activeCode: string | null
  onActiveChange: (code: string | null) => void
}

function InteractivePie({
  slices,
  activeCode,
  onActiveChange,
}: InteractivePieProps) {
  const meta = useMemo(() => buildSliceMeta(slices), [slices])
  const active = meta.find((slice) => slice.code === activeCode) ?? null
  const size = 208
  const cx = size / 2
  const cy = size / 2
  const outerR = 94
  const innerR = 54

  return (
    <div className={styles.pieWrap}>
      <svg
        className={styles.pieSvg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Portföy dağılımı"
      >
        {meta.map((slice) => {
          const isActive = activeCode === slice.code
          const isDimmed = activeCode != null && !isActive
          return (
            <path
              key={slice.code}
              d={donutPath(
                cx,
                cy,
                outerR,
                innerR,
                slice.startAngle,
                slice.endAngle,
              )}
              fill={slice.color}
              className={[
                styles.pieSlice,
                isActive ? styles.pieSliceActive : "",
                isDimmed ? styles.pieSliceDimmed : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => onActiveChange(slice.code)}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={innerR - 1} className={styles.pieCenter} />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className={styles.pieCenterLabel}
        >
          {active ? active.code : "Portföy"}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className={styles.pieCenterValue}
        >
          {active ? formatPct(active.weightPct) : `${slices.length} kalem`}
        </text>
      </svg>

      <div
        className={[
          styles.pieTooltip,
          active ? styles.pieTooltipVisible : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!active}
      >
        {active ? (
          <>
            <span
              className={styles.tooltipSwatch}
              style={{ background: active.color }}
            />
            <div className={styles.tooltipBody}>
              <p className={styles.tooltipCode}>{active.code}</p>
              <p className={styles.tooltipWeight}>
                Ağırlık {formatPct(active.weightPct)}
              </p>
              {active.note ? (
                <p className={styles.tooltipNote}>{active.note}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

type ProposalCardProps = {
  summary: ProposalSummary
  selected: boolean
  viewMode: ViewMode
  onSelect: () => void
}

function ProposalCard({
  summary,
  selected,
  viewMode,
  onSelect,
}: ProposalCardProps) {
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const sliceMeta = useMemo(
    () => buildSliceMeta(summary.chartSlices),
    [summary.chartSlices],
  )

  return (
    <article
      className={[styles.proposalCard, selected ? styles.proposalSelected : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <div className={styles.proposalHeader}>
        <div>
          <p className={styles.proposalTitle}>{summary.title}</p>
          <span className={styles.proposalTag}>{summary.label}</span>
        </div>
        <span className={styles.stockCount}>{summary.stockCount} hisse</span>
      </div>

      <div className={styles.metricRow}>
        <div className={styles.metricChip}>
          <p className={styles.metricLabel}>Hisse Oranı</p>
          <p className={styles.metricValue}>{formatPct(summary.equityPct)}</p>
        </div>
        <div className={styles.metricChip}>
          <p className={styles.metricLabel}>TPP Oranı</p>
          <p className={styles.metricValue}>{formatPct(summary.tppPct)}</p>
        </div>
      </div>

      {viewMode === "pie" ? (
        <div
          className={styles.pieBlock}
          onMouseLeave={() => setActiveCode(null)}
        >
          <InteractivePie
            slices={summary.chartSlices}
            activeCode={activeCode}
            onActiveChange={setActiveCode}
          />
          <ul className={styles.legendList}>
            {sliceMeta.map((slice) => {
              const isActive = activeCode === slice.code
              return (
                <li
                  key={slice.code}
                  className={[
                    styles.legendItem,
                    isActive ? styles.legendItemActive : "",
                    activeCode && !isActive ? styles.legendItemDimmed : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActiveCode(slice.code)}
                >
                  <span
                    className={styles.legendSwatch}
                    style={{ background: slice.color }}
                  />
                  <span className={styles.legendCode}>{slice.code}</span>
                  <span className={styles.legendPct}>
                    {formatPct(slice.weightPct)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.holdingsTable}>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Ağırlık</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {summary.allHoldings.map((holding, index) => (
                <tr key={`${holding.code}-${index}`}>
                  <td>
                    <span className={styles.tableCodeCell}>
                      <span
                        className={styles.legendSwatch}
                        style={{
                          background: colorForIndex(index, holding.code),
                        }}
                      />
                      {holding.code}
                    </span>
                  </td>
                  <td>{formatPct(holding.weightPct)}</td>
                  <td>{holding.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}

export default function FundDesignAlternativesPage() {
  const navigate = useNavigate()
  const { draftId } = useParams<{ draftId: string }>()
  const { init, error: initError, reload: reloadInit } = useFundDraftInit({
    page: "ALTERNATIVES",
  })

  const [proposals, setProposals] = useState<FundModelProposal[]>([])
  const [selectedRank, setSelectedRank] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("pie")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!draftId) return
    const controller = new AbortController()

    async function load() {
      try {
        let state = await getFundDraftAnalysisState(draftId!, controller.signal)
        if (controller.signal.aborted) return

        if (!state.proposals.length) {
          await runFundDraftAnalysis(draftId!, controller.signal)
          if (controller.signal.aborted) return
          state = await getFundDraftAnalysisState(draftId!, controller.signal)
          if (controller.signal.aborted) return
        }

        setProposals(state.proposals)
        const savedRank = state.selectedRank
        const stillValid =
          savedRank != null &&
          state.proposals.some((proposal) => proposal.rank === savedRank)

        setSelectedRank(
          stillValid ? savedRank : (state.proposals[0]?.rank ?? null),
        )
      } catch (error) {
        if (controller.signal.aborted) return
        setFormError(
          error instanceof Error
            ? error.message
            : "Portföy alternatifleri alınamadı",
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [draftId])

  async function handleSelect(rank: number) {
    setSelectedRank(rank)
    if (!draftId) return
    setFormError("")
    try {
      await selectFundDraftProposal(draftId, rank)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Öneri seçilemedi",
      )
    }
  }

  async function handleContinue() {
    if (!draftId || selectedRank == null) return
    setIsSaving(true)
    setFormError("")
    try {
      await selectFundDraftProposal(draftId, selectedRank)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Öneri seçilemedi",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const summaries = useMemo(
    () => proposals.map((proposal) => summarizeProposal(proposal)),
    [proposals],
  )

  return (
    <FundDesignLayout step={4}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>4. Portföy Alternatifleri</h2>
          <p className={styles.introLead}>Model önerileri</p>
          <p className={styles.intro}>
            Pasta dilimine gelince hisse ve ağırlık görünür. Bir öneri seçip
            kaydedin.
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
            {isLoading ? (
              <p className={styles.loading}>Öneriler yükleniyor…</p>
            ) : summaries.length === 0 ? (
              <p className={styles.loading}>Gösterilecek öneri bulunamadı.</p>
            ) : (
              <>
                <div className={styles.chartToolbar}>
                  <p className={styles.chartToolbarLabel}>Görünüm</p>
                  <div
                    className={styles.viewToggle}
                    role="group"
                    aria-label="Görünüm"
                  >
                    <button
                      type="button"
                      className={[
                        styles.viewBtn,
                        viewMode === "pie" ? styles.viewBtnActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setViewMode("pie")}
                    >
                      Pasta
                    </button>
                    <button
                      type="button"
                      className={[
                        styles.viewBtn,
                        viewMode === "table" ? styles.viewBtnActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setViewMode("table")}
                    >
                      Tablo
                    </button>
                  </div>
                </div>
                <div className={styles.proposalGrid}>
                  {summaries.map((summary) => (
                    <ProposalCard
                      key={summary.rank}
                      summary={summary}
                      selected={selectedRank === summary.rank}
                      viewMode={viewMode}
                      onSelect={() => handleSelect(summary.rank)}
                    />
                  ))}
                </div>
              </>
            )}

            <div className={styles.actions}>
              <button
                className={styles.back}
                type="button"
                onClick={() => {
                  if (!draftId) return
                  void navigate(`/fund-design/${draftId}/analysis`)
                }}
              >
                ← Geri
              </button>
              <Button
                className={styles.continue}
                type="button"
                disabled={selectedRank == null || !draftId || isSaving}
                onClick={() => void handleContinue()}
              >
                {isSaving ? "Kaydediliyor…" : "Seçimi Kaydet"}
              </Button>
            </div>
          </div>

          <ProspectusRulesPanel init={init} />
        </div>
      </section>
    </FundDesignLayout>
  )
}
