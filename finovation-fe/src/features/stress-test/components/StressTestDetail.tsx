import {
    formatStressDate,
    formatStressPercentage,
} from "@/features/stress-test/lib/stressTestFormatters"
import type { StressTestDetailResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"

type StressTestDetailProps = {
    detail: StressTestDetailResponse
    onClose: () => void
}

export default function StressTestDetail({
                                             detail,
                                             onClose,
                                         }: StressTestDetailProps) {
    return (
        <div className={styles.historyDetail}>
            <div className={styles.historyDetailHeader}>
                <div>
                    <span>Test Detayı</span>
                    <h3>{detail.scenarioName}</h3>
                </div>

                <button type="button" onClick={onClose}>
                    Kapat
                </button>
            </div>

            <div className={styles.historyDetailSummary}>
                <div>
                    <span>Portföy Etkisi</span>
                    <strong>
                        {formatStressPercentage(detail.portfolioImpact)}
                    </strong>
                </div>

                <div>
                    <span>Veri Tarihi</span>
                    <strong>{formatStressDate(detail.asOfDate)}</strong>
                </div>
            </div>
        </div>
    )
}