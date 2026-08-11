import { useEffect, useState } from "react"

import {
    fetchStressTestHistory,
    runStressTest,
} from "@/features/stress-test/api/stressTestService"
import StressScenarioCards from "@/features/stress-test/components/StressScenarioCards"
import StressTestDeleteConfirm from "@/features/stress-test/components/StressTestDeleteConfirm"
import StressTestDetailDialog from "@/features/stress-test/components/StressTestDetailDialog"
import StressTestHistory from "@/features/stress-test/components/StressTestHistory"
import StressTestResultView from "@/features/stress-test/components/StressTestResultView"
import { useStressTestSetup } from "@/features/stress-test/hooks/useStressTestSetup"
import type {
    RunStressTestResponse,
    StressTestHistoryResponse,
} from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestPage.module.css"
import StressTestModeTabs from "@/features/stress-test/components/StressTestModeTabs"

export default function StressTestPage() {
    const {
        funds,
        scenarios,
        selectedFundId,
        isLoading,
        errorMessage,
        selectFund,
    } = useStressTestSetup()

    const [result, setResult] = useState<RunStressTestResponse | null>(null)
    const [runningScenarioCode, setRunningScenarioCode] = useState("")
    const [runError, setRunError] = useState("")

    const [history, setHistory] = useState<StressTestHistoryResponse[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(true)
    const [historyError, setHistoryError] = useState("")

    const [detailTestId, setDetailTestId] = useState<string | null>(null)
    const [deleteTestId, setDeleteTestId] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()

        async function loadHistory() {
            setIsHistoryLoading(true)
            setHistoryError("")

            try {
                const response = await fetchStressTestHistory(controller.signal)
                setHistory(response)
            } catch (error) {
                if (controller.signal.aborted) return

                setHistory([])
                setHistoryError(
                    error instanceof Error
                        ? error.message
                        : "Stres testi geçmişi yüklenemedi.",
                )
            } finally {
                if (!controller.signal.aborted) {
                    setIsHistoryLoading(false)
                }
            }
        }

        void loadHistory()

        return () => controller.abort()
    }, [])

    const hasFunds = funds.length > 0

    async function handleRunStressTest(scenarioCode: string) {
        if (!selectedFundId || runningScenarioCode) return

        setRunningScenarioCode(scenarioCode)
        setRunError("")

        try {
            const response = await runStressTest({
                fundId: selectedFundId,
                scenarioCode,
            })

            setResult(response)
            try {
                setHistory(await fetchStressTestHistory())
                setHistoryError("")
            } catch {
                setHistoryError("Stres testi geçmişi yenilenemedi.")
            }
        } catch (error) {
            setResult(null)

            setRunError(
                error instanceof Error
                    ? error.message
                    : "Stres testi çalıştırılamadı.",
            )
        } finally {
            setRunningScenarioCode("")
        }
    }

    return (
        <main className={styles.page} aria-busy={isLoading}>
            <div className={styles.shell}>
                <StressTestModeTabs />

                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1>Stres Testi</h1>
                        <p>Portföy Risk Analizi</p>
                    </div>

                    <label className={styles.fundSelect}>
                        <span>Test edilecek fon</span>

                        <select
                            value={selectedFundId}
                            disabled={!hasFunds || isLoading}
                            onChange={(event) => {
                                selectFund(event.target.value)
                                setResult(null)
                                setRunError("")
                            }}
                        >
                            {!hasFunds && (
                                <option value="">Kullanılabilir fon bulunmuyor</option>
                            )}

                            {funds.map((fund) => (
                                <option value={fund.id} key={fund.id}>
                                    {fund.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </header>



                {isLoading && (
                    <div className={styles.loadingBanner} role="status">
                        Stres testi verileri yükleniyor…
                    </div>
                )}

                {!isLoading && errorMessage && (
                    <div className={styles.errorBanner} role="alert">
                        <strong>Veriler alınamadı</strong>
                        <span>{errorMessage}</span>
                    </div>
                )}

                {!isLoading && !errorMessage && !hasFunds && (
                    <div className={styles.infoBanner} role="status">
                        Stres testi çalıştırılabilecek bir fon bulunmuyor.
                    </div>
                )}

                {!isLoading && !errorMessage && (
                    <section
                        className={styles.scenarioSection}
                        aria-labelledby="stress-scenarios-title"
                    >
                        <div className={styles.sectionHeading}>
                            <div>
                                <span>Hazır Senaryolar</span>
                                <h2 id="stress-scenarios-title">
                                    Piyasa stres senaryoları
                                </h2>
                            </div>

                            <p>Analiz etmek istediğiniz piyasa koşulunu seçin.</p>
                        </div>

                        <StressScenarioCards
                            scenarios={scenarios}
                            disabled={!selectedFundId}
                            runningScenarioCode={runningScenarioCode}
                            onRun={handleRunStressTest}
                        />

                        {runError && (
                            <div className={styles.runError} role="alert">
                                {runError}
                            </div>
                        )}

                        {result && <StressTestResultView result={result} />}
                    </section>
                )}

                <StressTestHistory
                    tests={history}
                    isLoading={isHistoryLoading}
                    errorMessage={historyError}
                    onDetail={setDetailTestId}
                    onDelete={setDeleteTestId}
                />

                <StressTestDetailDialog
                    testId={detailTestId}
                    onClose={() => setDetailTestId(null)}
                />

                <StressTestDeleteConfirm
                    testId={deleteTestId}
                    onClose={() => setDeleteTestId(null)}
                    onDeleted={(testId) =>
                        setHistory((current) =>
                            current.filter((test) => test.testId !== testId),
                        )
                    }
                />
            </div>
        </main>
    )
}
