import type { StressScenarioResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"
import Button from "@/shared/ui/Button"

type StressScenarioCardsProps = {
    scenarios: StressScenarioResponse[]
    disabled?: boolean
    runningScenarioCode?: string
    onRun: (scenarioCode: string) => void
}

export default function StressScenarioCards({
                                                scenarios,
                                                disabled = false,
                                                runningScenarioCode,
                                                onRun,
                                            }: StressScenarioCardsProps) {
    if (scenarios.length === 0) {
        return (
            <div className={styles.emptyState}>
                Şu anda kullanılabilir stres senaryosu bulunmuyor.
            </div>
        )
    }

    return (
        <div className={styles.scenarioGrid}>
            {scenarios.map((scenario) => {
                const isRunning = runningScenarioCode === scenario.code

                return (
                    <article className={styles.scenarioCard} key={scenario.code}>
                        <div className={styles.scenarioIcon} aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <path d="M4 18 9 12l4 3 7-9" />
                                <path d="M16 6h4v4" />
                            </svg>
                        </div>

                        <div className={styles.scenarioContent}>
                            <h3>{scenario.name}</h3>
                            <p>{scenario.description}</p>
                        </div>

                        <Button
                            className={styles.runButton}
                            disabled={disabled || Boolean(runningScenarioCode)}
                            isLoading={isRunning}
                            loadingText="Çalıştırılıyor…"
                            onClick={() => onRun(scenario.code)}
                        >
                            Testi Çalıştır
                        </Button>
                    </article>
                )
            })}
        </div>
    )
}