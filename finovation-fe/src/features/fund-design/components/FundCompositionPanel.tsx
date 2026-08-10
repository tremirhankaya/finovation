import { useEffect, useMemo, useState } from "react"

import {
  getWorkingPortfolio,
  type WorkingPortfolioResponse,
} from "@/features/fund-design/api/fundDraftApi"
import DonutChart, {
  DONUT_COLORS,
  type DonutSlice,
} from "@/shared/ui/DonutChart"
import styles from "@/features/fund-design/styles/FundCompositionPanel.module.css"

const VISIBLE_HOLDING_COUNT = 5
const OTHER_HOLDINGS_LABEL = "Diğer hisseler"
const TPP_LABEL = "TPP"
const TPP_COLOR = "#b6c2cd"
const OTHER_COLOR = "#cbd5dd"

type FundCompositionPanelProps = {
  draftId: string
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `%${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`
}

export default function FundCompositionPanel({
  draftId,
}: FundCompositionPanelProps) {
  const [portfolio, setPortfolio] = useState<WorkingPortfolioResponse | null>(
    null,
  )
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

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
    const equities = holdings.filter((holding) => holding.asset_type === "EQUITY")
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

    if (otherWeight > 0) {
      slices.push({
        id: OTHER_HOLDINGS_LABEL,
        label: `${OTHER_HOLDINGS_LABEL} (${equities.length - VISIBLE_HOLDING_COUNT})`,
        value: otherWeight,
        color: OTHER_COLOR,
      })
    }

    if (tppWeight > 0) {
      slices.push({
        id: TPP_LABEL,
        label: TPP_LABEL,
        value: tppWeight,
        color: TPP_COLOR,
      })
    }

    return slices
  }, [holdings])

  const heaviestWeight = holdings.at(0)?.weight ?? 0

  if (isLoading) {
    return <p className={styles.status}>Portföy yükleniyor…</p>
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
          />
          <ul className={styles.legend}>
            {weightSlices.map((slice, index) => (
              <li key={slice.id} className={styles.legendItem}>
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
        </section>

        <section className={styles.holdings}>
          <h4 className={styles.blockTitle}>
            Portföy içeriği
            <span className={styles.blockCount}>{holdings.length} varlık</span>
          </h4>
          <ul className={styles.holdingList}>
            {holdings.map((holding) => (
              <li key={holding.asset_code} className={styles.holding}>
                <span className={styles.holdingCode}>{holding.asset_code}</span>
                <span className={styles.holdingTrack}>
                  <span
                    className={[
                      styles.holdingFill,
                      holding.asset_type === "TPP" ? styles.holdingFillTpp : "",
                    ].join(" ")}
                    style={{
                      width:
                        heaviestWeight > 0
                          ? `${(holding.weight / heaviestWeight) * 100}%`
                          : "0%",
                    }}
                  />
                </span>
                <span className={styles.holdingWeight}>
                  {formatPct(holding.weight)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
