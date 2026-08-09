import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressPortfolioDonutProps = {
    assets: StressTestAssetResponse[]
}

const PALETTE = [
    "#0f766e",
    "#14b8a6",
    "#0f2d52",
    "#3b82f6",
    "#64748b",
    "#94a3b8",
    "#cbd5e1",
]

export default function StressPortfolioDonut({
                                                 assets,
                                             }: StressPortfolioDonutProps) {
    if (assets.length === 0) return null

    const sortedAssets = [...assets].sort(
        (a, b) => b.weight - a.weight,
    )

    const visibleAssets = sortedAssets.slice(0, 6)
    const otherWeight = sortedAssets
        .slice(6)
        .reduce((sum, asset) => sum + asset.weight, 0)

    const slices = [
        ...visibleAssets.map((asset) => ({
            label: asset.assetCode,
            weight: asset.weight,
        })),
        ...(otherWeight > 0
            ? [{ label: "Diğer", weight: otherWeight }]
            : []),
    ]

    const totalWeight = slices.reduce(
        (sum, slice) => sum + slice.weight,
        0,
    )

    let current = 0

    const gradient = slices
        .map((slice, index) => {
            const start = current
            const end =
                current + (slice.weight / totalWeight) * 100

            current = end

            return `${PALETTE[index]} ${start}% ${end}%`
        })
        .join(", ")

    return (
        <section
            className={styles.donutCard}
            aria-labelledby="portfolio-distribution-title"
        >
            <div className={styles.chartHeader}>
                <div>
                    <span>Portföy Dağılımı</span>
                    <h2 id="portfolio-distribution-title">
                        Varlık ağırlıkları
                    </h2>
                </div>

                <p>Stres testine giren portföyün mevcut dağılımı.</p>
            </div>

            <div className={styles.donutContent}>
                <div
                    className={styles.donut}
                    style={{
                        background: `conic-gradient(${gradient})`,
                    }}
                    role="img"
                    aria-label="Portföy varlık dağılımı"
                >
                    <div className={styles.donutCenter}>
                        <strong>{assets.length}</strong>
                        <span>Varlık</span>
                    </div>
                </div>

                <div className={styles.donutLegend}>
                    {slices.map((slice, index) => (
                        <div
                            className={styles.donutLegendItem}
                            key={slice.label}
                        >
              <span
                  className={styles.donutLegendColor}
                  style={{
                      backgroundColor: PALETTE[index],
                  }}
                  aria-hidden="true"
              />

                            <strong>{slice.label}</strong>

                            <span>{slice.weight.toFixed(2)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}