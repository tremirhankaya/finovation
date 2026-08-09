import StressAssetImpactChart from "@/features/stress-test/components/StressAssetImpactChart"
import StressContributionChart from "@/features/stress-test/components/StressContributionChart"
import StressPortfolioDonut from "@/features/stress-test/components/StressPortfolioDonut"
import StressTestAssetTable from "@/features/stress-test/components/StressTestAssetTable"
import StressTestResultSummary from "@/features/stress-test/components/StressTestResultSummary"
import { downloadStressTestPdf } from "@/features/stress-test/lib/stressTestPdf"
import type { RunStressTestResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"

type StressTestResultViewProps = {
    result: RunStressTestResponse
}

export default function StressTestResultView({
                                                 result,
                                             }: StressTestResultViewProps) {
    return (
        <>
            <div className={styles.resultToolbar}>
                <button
                    type="button"
                    className={styles.pdfButton}
                    onClick={() => downloadStressTestPdf(result)}
                >
                    PDF İndir
                </button>
            </div>

            <StressTestResultSummary result={result} />

            <section
                className={styles.analysisSection}
                aria-labelledby="stress-analysis-title"
            >
                <div className={styles.analysisHeading}>
                    <div>
                        <span>Detaylı Analiz</span>
                        <h2 id="stress-analysis-title">
                            Portföy ve varlık bazlı etkiler
                        </h2>
                    </div>

                    <p>
                        Sonucun hangi varlıklardan kaynaklandığını ve varlıkların
                        senaryodan ne ölçüde etkilendiğini karşılaştırın.
                    </p>
                </div>

                <div className={styles.chartLayout}>
                    <div className={styles.chartTopRow}>
                        <StressPortfolioDonut assets={result.assets} />
                        <StressContributionChart assets={result.assets} />
                    </div>

                    <StressAssetImpactChart assets={result.assets} />
                </div>
            </section>

            <StressTestAssetTable assets={result.assets} />
        </>
    )
}