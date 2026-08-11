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
import { FundLoader } from "@/shared/ui/FundLoader"
import DonutChart from "@/shared/ui/DonutChart"
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
}

function formatPct(value: number): string {
  return `%${value.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  })}`
}

function buildSliceMeta(slices: HoldingSlice[]): SliceMeta[] {
  return slices.map((slice, index) => {
    return {
      ...slice,
      color: colorForIndex(index, slice.code),
    }
  })
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
          // Dilime fareyle tıklandığında tarayıcının SVG odak çerçevesi
          // görünmesin; klavye odağı ve kart seçimi ise korunur.
          onPointerDownCapture={(event) => event.preventDefault()}
        >
          <DonutChart
            slices={sliceMeta.map((slice) => ({
              id: slice.code,
              label: slice.code,
              value: slice.weightPct,
              color: slice.color,
              description: slice.note ?? undefined,
            }))}
            ariaLabel={`${summary.title} portföy dağılımı`}
            formatValue={formatPct}
            highlightedSliceId={activeCode}
            onHighlightChange={setActiveCode}
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
  const {
    init,
    error: initError,
    reload: reloadInit,
  } = useFundDraftInit({
    page: "ALTERNATIVES",
    draftId,
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

  function handleSelect(rank: number) {
    if (selectedRank === rank) return
    setSelectedRank(rank)
    setFormError("")
  }

  async function handleContinue() {
    if (!draftId || selectedRank == null) return
    setIsSaving(true)
    setFormError("")
    try {
      await selectFundDraftProposal(draftId, selectedRank)
      void navigate(`/fund-design/${draftId}/edit`)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Öneri seçilemedi")
    } finally {
      setIsSaving(false)
    }
  }

  const summaries = useMemo(
    () => proposals.map((proposal) => summarizeProposal(proposal)),
    [proposals],
  )

  return (
    <FundDesignLayout step={4} isLoading={isLoading}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.sectionTitle}>4. Portföy Alternatifleri</h2>
          <p className={styles.introLead}>Model önerileri</p>
          <p className={styles.intro}>
            Pasta dilimine gelince hisse ve ağırlık görünür. Bir öneri seçip
            kaydedin; sonraki ekranda dilerseniz seçiminizi değiştirebilir ve
            portföy üzerinde düzenleme yapabilirsiniz.
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
              <FundLoader message="Öneriler yükleniyor..." />
            ) : summaries.length === 0 ? (
              <p className={styles.loading}>Gösterilecek öneri bulunamadı.</p>
            ) : (
              <>
                <div className={styles.chartToolbar}>
                  <div>
                    <p className={styles.chartToolbarLabel}>Portföy dağılımı</p>
                    <p className={styles.chartToolbarHint}>Önerileri inceleyin ve seçmek için karta tıklayın.</p>
                  </div>
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
