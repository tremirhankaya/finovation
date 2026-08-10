import { useEffect, useMemo, useState } from "react"

import {
  getWorkingPortfolio,
  type WorkingPortfolioResponse,
} from "@/features/fund-design/api/fundDraftApi"
import styles from "@/features/fund-design/styles/FundCompositionPanel.module.css"

const TOP_HOLDING_COUNT = 5

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

  const topHoldings = useMemo(() => {
    if (!portfolio) return []
    return portfolio.assets
      .filter((asset) => asset.asset_type === "EQUITY")
      .sort((left, right) => right.weight - left.weight)
      .slice(0, TOP_HOLDING_COUNT)
  }, [portfolio])

  const heaviestWeight = topHoldings.at(0)?.weight ?? 0

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
          <dt>Hisse Oranı</dt>
          <dd>{formatPct(portfolio.equityWeightPct)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>TPP Oranı</dt>
          <dd>{formatPct(portfolio.tppWeightPct)}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Hisse Sayısı</dt>
          <dd>{portfolio.stockCount ?? "—"}</dd>
        </div>
        <div className={styles.metric}>
          <dt>Sektör Sayısı</dt>
          <dd>{portfolio.sectorCount ?? "—"}</dd>
        </div>
      </dl>

      <div className={styles.holdings}>
        <h4 className={styles.holdingsTitle}>
          En Yüksek Ağırlıklı {TOP_HOLDING_COUNT} Hisse
        </h4>
        <ul className={styles.holdingList}>
          {topHoldings.map((holding) => (
            <li key={holding.asset_code} className={styles.holding}>
              <span className={styles.holdingCode}>{holding.asset_code}</span>
              <span className={styles.holdingTrack}>
                <span
                  className={styles.holdingFill}
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
      </div>
    </div>
  )
}
