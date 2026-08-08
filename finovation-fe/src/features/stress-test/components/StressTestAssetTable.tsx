import {
    formatStressPercentage,
    formatStressWeight,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestAssetResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"

type StressTestAssetTableProps = {
    assets: StressTestAssetResponse[]
}

function getValueClass(value: number): string {
    if (value > 0) return styles.positiveValue
    if (value < 0) return styles.negativeValue

    return styles.neutralValue
}

export default function StressTestAssetTable({
                                                 assets,
                                             }: StressTestAssetTableProps) {
    if (assets.length === 0) {
        return (
            <div className={styles.emptyState}>
                Bu stres testi için varlık sonucu bulunmuyor.
            </div>
        )
    }

    return (
        <section
            className={styles.assetSection}
            aria-labelledby="stress-assets-title"
        >
            <div className={styles.sectionHeading}>
                <div>
                    <span>Varlık Detayları</span>
                    <h2 id="stress-assets-title">Stres testi sonuçları</h2>
                </div>

                <p>Portföydeki varlıkların senaryo bazlı etkileri.</p>
            </div>

            <div className={styles.assetTableWrapper}>
                <table className={styles.assetTable}>
                    <thead>
                    <tr>
                        <th scope="col">Varlık</th>
                        <th scope="col">Varlık Tipi</th>
                        <th scope="col">Portföy Ağırlığı</th>
                        <th scope="col">Varlık Etkisi</th>
                        <th scope="col">Portföye Etkisi</th>
                    </tr>
                    </thead>

                    <tbody>
                    {assets.map((asset) => (
                        <tr key={asset.assetCode}>
                            <td className={styles.assetCode}>{asset.assetCode}</td>

                            <td>
                  <span className={styles.assetType}>
                    {asset.assetType}
                  </span>
                            </td>

                            <td>{formatStressWeight(asset.weight)}</td>

                            <td className={getValueClass(asset.impact)}>
                                {formatStressPercentage(asset.impact)}
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
        </section>
    )
}