import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { RunStressTestResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"

type StressTestResultSummaryProps = {
    result: RunStressTestResponse
}

export default function StressTestResultSummary({
                                                    result,
                                                }: StressTestResultSummaryProps) {
    const impactStatus =
        result.portfolioImpact > 0
            ? "Pozitif"
            : result.portfolioImpact < 0
                ? "Negatif"
                : "Nötr"

    const negativeContribution = result.assets
        .filter((asset) => asset.portfolioContribution < 0)
        .sort(
            (a, b) =>
                a.portfolioContribution - b.portfolioContribution,
        )[0]

    const positiveContribution = result.assets
        .filter((asset) => asset.portfolioContribution > 0)
        .sort(
            (a, b) =>
                b.portfolioContribution - a.portfolioContribution,
        )[0]

    const mostAffectedAsset = result.assets.reduce(
        (current, asset) =>
            Math.abs(asset.impact) > Math.abs(current.impact)
                ? asset
                : current,
        result.assets[0],
    )

    return (
        <section
            className={styles.resultSection}
            aria-labelledby="stress-test-result-title"
        >
            <div className={styles.sectionHeading}>
                <div>
                    <span>Test Sonucu</span>
                    <h2 id="stress-test-result-title">{result.scenarioName}</h2>
                </div>

                <p>Senaryonun seçili portföy üzerindeki tahmini etkisi.</p>
            </div>

            <div className={styles.resultGrid}>
                <article className={styles.primaryKpi}>
                    <span>Toplam Portföy Etkisi</span>

                    <strong
                        className={
                            result.portfolioImpact > 0
                                ? styles.positiveValue
                                : result.portfolioImpact < 0
                                    ? styles.negativeValue
                                    : styles.neutralValue
                        }
                    >
                        {formatStressPercentage(result.portfolioImpact)}
                    </strong>

                    <small>{impactStatus} etki</small>
                </article>

                <article className={styles.kpiCard}>
                    <span>Veri Tarihi</span>
                    <strong>{formatStressDate(result.asOfDate)}</strong>
                    <small>Analizde kullanılan portföy tarihi</small>
                </article>

                <article className={styles.kpiCard}>
                    <span>Analiz Edilen Varlık</span>
                    <strong>{result.assets.length}</strong>
                    <small>Stres testine dahil edilen varlık sayısı</small>
                </article>
            </div>

            {result.assets.length > 0 && (
                <div className={styles.insightGrid}>
                    <article className={styles.insightCard}>
                        <span>En Büyük Negatif Katkı</span>

                        {negativeContribution ? (
                            <>
                                <strong>{negativeContribution.assetCode}</strong>
                                <small className={styles.negativeValue}>
                                    {formatStressPercentage(
                                        negativeContribution.portfolioContribution,
                                    )}
                                </small>
                            </>
                        ) : (
                            <>
                                <strong>—</strong>
                                <small className={styles.neutralValue}>
                                    Negatif katkı yok
                                </small>
                            </>
                        )}
                    </article>

                    <article className={styles.insightCard}>
                        <span>En Büyük Pozitif Katkı</span>

                        {positiveContribution ? (
                            <>
                                <strong>{positiveContribution.assetCode}</strong>
                                <small className={styles.positiveValue}>
                                    {formatStressPercentage(
                                        positiveContribution.portfolioContribution,
                                    )}
                                </small>
                            </>
                        ) : (
                            <>
                                <strong>—</strong>
                                <small className={styles.neutralValue}>
                                    Pozitif katkı yok
                                </small>
                            </>
                        )}
                    </article>

                    <article className={styles.insightCard}>
                        <span>En Çok Etkilenen Varlık</span>
                        <strong>{mostAffectedAsset.assetCode}</strong>

                        <small
                            className={
                                mostAffectedAsset.impact > 0
                                    ? styles.positiveValue
                                    : mostAffectedAsset.impact < 0
                                        ? styles.negativeValue
                                        : styles.neutralValue
                            }
                        >
                            {formatStressPercentage(mostAffectedAsset.impact)}
                        </small>
                    </article>
                </div>
            )}
        </section>
    )
}