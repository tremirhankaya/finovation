import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestHistoryResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestHistory.module.css"
type StressTestHistoryProps = {
    tests: StressTestHistoryResponse[]
    isLoading: boolean
    errorMessage: string
    onDetail: (testId: string) => void
    onDelete: (testId: string) => void
}

function formatCreatedAt(value: string): string {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date)
}

export default function StressTestHistory({
                                              tests,
                                              isLoading,
                                              errorMessage,
                                              onDetail,
                                              onDelete,
                                          }: StressTestHistoryProps) {
    return (
        <section
            className={styles.historySection}
            aria-labelledby="stress-history-title"
        >
            <div className={styles.sectionHeading}>
                <div>
                    <span>Geçmiş Testler</span>
                    <h2 id="stress-history-title">
                        Önceki stres testi sonuçları
                    </h2>
                </div>

                <p>Daha önce tamamlanan stres testlerinizi inceleyin.</p>
            </div>

            {isLoading && (
                <div className={styles.loadingBanner} role="status">
                    Stres testi geçmişi yükleniyor…
                </div>
            )}

            {!isLoading && errorMessage && (
                <div className={styles.errorBanner} role="alert">
                    <strong>Geçmiş yüklenemedi</strong>
                    <span>{errorMessage}</span>
                </div>
            )}

            {!isLoading && !errorMessage && tests.length === 0 && (
                <div className={styles.emptyState}>
                    Henüz çalıştırılmış bir stres testi bulunmuyor.
                </div>
            )}

            {!isLoading && !errorMessage && tests.length > 0 && (
                <div className={styles.historyTableWrapper}>
                    <table className={styles.historyTable}>
                        <thead>
                        <tr>
                            <th scope="col">Senaryo</th>
                            <th scope="col">Test Tarihi</th>
                            <th scope="col">Veri Tarihi</th>
                            <th scope="col">Portföy Etkisi</th>
                            <th scope="col">İşlemler</th>
                        </tr>
                        </thead>

                        <tbody>
                        {tests.map((test) => (
                            <tr key={test.testId}>
                                <td className={styles.historyScenario}>
                                    {test.scenarioName}
                                </td>

                                <td>{formatCreatedAt(test.createdAt)}</td>
                                <td>{formatStressDate(test.asOfDate)}</td>

                                <td
                                    className={
                                        test.portfolioImpact > 0
                                            ? styles.positiveValue
                                            : test.portfolioImpact < 0
                                                ? styles.negativeValue
                                                : styles.neutralValue
                                    }
                                >
                                    {formatStressPercentage(test.portfolioImpact)}
                                </td>

                                <td>
                                    <div className={styles.historyActions}>
                                        <button
                                            type="button"
                                            onClick={() => onDetail(test.testId)}
                                        >
                                            Detay
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.deleteAction}
                                            onClick={() => onDelete(test.testId)}
                                        >
                                            Sil
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}