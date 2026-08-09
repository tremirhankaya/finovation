import { formatStressPercentage } from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressContributionChartProps = {
    assets: StressTestAssetResponse[]
}

const MAX_VISIBLE_ASSETS = 8

export default function StressContributionChart({
                                                    assets,
                                                }: StressContributionChartProps) {
    if (assets.length === 0) return null

    const sortedAssets = [...assets].sort(
        (a, b) =>
            Math.abs(b.portfolioContribution) -
            Math.abs(a.portfolioContribution),
    )

    const visibleAssets = sortedAssets.slice(0, MAX_VISIBLE_ASSETS)

    const maxContribution = Math.max(
        ...visibleAssets.map((asset) =>
            Math.abs(asset.portfolioContribution),
        ),
    )

    return (
        <section
            className={styles.chartCard}
            aria-labelledby="contribution-chart-title"
        >
            <div className={styles.chartHeader}>
                <div>
                    <span>Portföye Katkı</span>
                    <h2 id="contribution-chart-title">
                        Varlıkların toplam sonuca etkisi
                    </h2>
                </div>

                <p>
                    {assets.length > MAX_VISIBLE_ASSETS
                        ? `En yüksek katkıya sahip ${MAX_VISIBLE_ASSETS} varlık gösteriliyor.`
                        : "Her varlığın stres testi sonucuna yaptığı katkı."}
                </p>
            </div>

            <div className={styles.contributionChart}>
                {visibleAssets.map((asset) => {
                    const contribution = asset.portfolioContribution

                    const width =
                        maxContribution === 0
                            ? 0
                            : (Math.abs(contribution) / maxContribution) * 50

                    const valueClass =
                        contribution > 0
                            ? styles.positiveValue
                            : contribution < 0
                                ? styles.negativeValue
                                : styles.neutralValue

                    return (
                        <div
                            className={styles.contributionRow}
                            key={asset.assetCode}
                        >
                            <div className={styles.contributionLabel}>
                                <strong>{asset.assetCode}</strong>
                                <span>{asset.assetType}</span>
                            </div>

                            <div className={styles.contributionTrack}>
                                <div className={styles.zeroLine} />

                                {contribution < 0 && (
                                    <div
                                        className={`${styles.contributionBar} ${styles.negativeBar}`}
                                        style={{
                                            width: `${width}%`,
                                            right: "50%",
                                        }}
                                    />
                                )}

                                {contribution > 0 && (
                                    <div
                                        className={`${styles.contributionBar} ${styles.positiveBar}`}
                                        style={{
                                            width: `${width}%`,
                                            left: "50%",
                                        }}
                                    />
                                )}
                            </div>

                            <strong className={valueClass}>
                                {formatStressPercentage(contribution)}
                            </strong>
                        </div>
                    )
                })}
            </div>

            <div className={styles.chartAxis}>
                <span>Negatif katkı</span>
                <span>0</span>
                <span>Pozitif katkı</span>
            </div>
        </section>
    )
}