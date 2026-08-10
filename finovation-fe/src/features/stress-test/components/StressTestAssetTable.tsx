import { useState } from "react"

import {
    formatStressPercentage,
    formatStressWeight,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"

type StressTestAssetTableProps = {
    assets: StressTestAssetResponse[]
}

const INITIAL_VISIBLE_COUNT = 8

function getValueClass(value: number): string {
    if (value > 0) return styles.positiveValue
    if (value < 0) return styles.negativeValue

    return styles.neutralValue
}

export default function StressTestAssetTable({
                                                 assets,
                                             }: StressTestAssetTableProps) {
    const [expanded, setExpanded] = useState(false)

    if (assets.length === 0) {
        return (
            <div className={styles.emptyState}>
                Bu stres testi için varlık sonucu bulunmuyor.
            </div>
        )
    }

    const visibleAssets = expanded
        ? assets
        : assets.slice(0, INITIAL_VISIBLE_COUNT)

    const hasMore = assets.length > INITIAL_VISIBLE_COUNT

    return (
        <section
            className={styles.assetSection}
            aria-labelledby="stress-assets-title"
        >
            <div className={styles.sectionHeading}>
                <div>
                    <span>Varlık Detayları</span>
                    <h2 id="stress-assets-title">
                        Stres testi sonuçları
                    </h2>
                </div>

                <p>
                    Portföydeki varlıkların senaryo bazlı etkileri.
                </p>
            </div>

            <div className={styles.assetTableWrapper}>
                <table className={styles.assetTable}>
                    <thead>
                    <tr>
                        <th scope="col">Varlık</th>
                        <th scope="col">Varlık Tipi</th>
                        <th scope="col">
                            Portföy Ağırlığı
                        </th>
                        <th scope="col">Varlık Etkisi</th>
                        <th scope="col">
                            Portföye Etkisi
                        </th>
                    </tr>
                    </thead>

                    <tbody>
                    {visibleAssets.map((asset) => (
                        <tr key={asset.assetCode}>
                            <td
                                className={
                                    styles.assetCode
                                }
                            >
                                {asset.assetCode}
                            </td>

                            <td>
                                    <span
                                        className={
                                            styles.assetType
                                        }
                                    >
                                        {asset.assetType}
                                    </span>
                            </td>

                            <td>
                                {formatStressWeight(
                                    asset.weight,
                                )}
                            </td>

                            <td
                                className={getValueClass(
                                    asset.impact,
                                )}
                            >
                                {formatStressPercentage(
                                    asset.impact,
                                )}
                            </td>

                            <td
                                className={getValueClass(
                                    asset.portfolioContribution,
                                )}
                            >
                                {formatStressPercentage(
                                    asset.portfolioContribution,
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <button
                    type="button"
                    className={styles.assetTableToggle}
                    onClick={() =>
                        setExpanded((current) => !current)
                    }
                    aria-expanded={expanded}
                >
                    <span aria-hidden="true">
                        {expanded ? "▴" : "▾"}
                    </span>

                    {expanded
                        ? "Daralt"
                        : `Tümünü göster (${assets.length})`}
                </button>
            )}
        </section>
    )
}