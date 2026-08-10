import type { RlInferenceResponse } from "@/features/stress-test/model/rlStressTest.types"
import styles from "@/features/stress-test/styles/RlStressTestPage.module.css"

type Props = {
    result: RlInferenceResponse
}

export default function RlStressTestSummary({
                                                result,
                                            }: Props) {
    const metrics = [
        {
            label: "Başlangıç NAV",
            value: `${result.initial_nav.toLocaleString("tr-TR")} ₺`,
        },
        {
            label: "RL Sonuç",
            value: `${result.final_nav.toLocaleString("tr-TR")} ₺`,
        },
        {
            label: "Pasif Sonuç",
            value: `${result.passive_final_nav.toLocaleString("tr-TR")} ₺`,
        },
        {
            label: "RL Getiri",
            value: `%${result.return_pct.toFixed(2)}`,
        },
        {
            label: "Pasif Getiri",
            value: `%${result.passive_return_pct.toFixed(2)}`,
        },
        {
            label: "RL Avantajı",
            value: `${result.outperformance_pct >= 0 ? "+" : ""}%${result.outperformance_pct.toFixed(2)}`,
        },
    ]

    return (
        <div className={styles.metricGrid}>
            {metrics.map((metric) => (
                <article
                    key={metric.label}
                    className={styles.metricCard}
                >
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                </article>
            ))}
        </div>
    )
}