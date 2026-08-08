import { formatStressPercentage } from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestCharts.module.css"

type StressAssetImpactChartProps = {
    assets: StressTestAssetResponse[]
}

const MAX_VISIBLE_ASSETS = 8

export default function StressAssetImpactChart({
                                                   assets,
                                               }: StressAssetImpactChartProps) {
    if (assets.length === 0) return null

    const sortedAssets = [...assets].sort(
        (a, b) => Math.abs(b.impact) - Math.abs(a.impact),
    )

    const visibleAssets = sortedAssets.slice(0, MAX_VISIBLE_ASSETS)

    const maxImpact = Math.max(
        ...visibleAssets.map((asset) => Math.abs(asset.impact)),
    )

    return (
        <section
            className={styles.chartCard}
            aria-labelledby="asset-impact-chart-title"
        >
            <div className={styles.chartHeader}>
                <div>
                    <span>Varlık Bazlı Etki</span>
                    <h2 id="asset-impact-chart-title">
                        Senaryodan en fazla etkilenen varlıklar
                    </h2>
                </div>

                <p>
                    {assets.length > MAX_VISIBLE_ASSETS
                        ? `En yüksek etkiye sahip ${MAX_VISIBLE_ASSETS} varlık gösteriliyor.`
                        : "Her varlığın seçilen piyasa senaryosundaki tahmini değişimi."}
                </p>
            </div>

            <div className={styles.impactChart}>
                {visibleAssets.map((asset) => {
                    const width =
                        maxImpact === 0
                            ? 0
                            : (Math.abs(asset.impact) / maxImpact) * 100

                    const valueClass =
                        asset.impact > 0
                            ? styles.positiveValue
                            : asset.impact < 0
                                ? styles.negativeValue
                                : styles.neutralValue

                    const barClass =
                        asset.impact > 0
                            ? styles.positiveBar
                            : asset.impact < 0
                                ? styles.negativeBar
                                : styles.neutralBar

                    return (
                        <div
                            className={styles.impactRow}
                            key={asset.assetCode}
                        >
                            <div className={styles.impactLabel}>
                                <strong>{asset.assetCode}</strong>
                                <span>{asset.assetType}</span>
                            </div>

                            <div className={styles.impactTrack}>
                                <div
                                    className={`${styles.impactBar} ${barClass}`}
                                    style={{ width: `${width}%` }}
                                />
                            </div>

                            <strong className={valueClass}>
                                {formatStressPercentage(asset.impact)}
                            </strong>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}