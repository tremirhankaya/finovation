import RlAnalysisTimeline from "@/features/stress-test/components/RlAnalysisTimeline"
import RlDayAnalysisPanel from "@/features/stress-test/components/RlDayAnalysisPanel"
import RlNavComparisonChart from "@/features/stress-test/components/RlNavComparisonChart"
import RlStressTestControls from "@/features/stress-test/components/RlStressTestControls"
import RlStressTestSummary from "@/features/stress-test/components/RlStressTestSummary"
import StressTestModeTabs from "@/features/stress-test/components/StressTestModeTabs"
import { useRlStressTest } from "@/features/stress-test/hooks/useRlStressTest"
import styles from "@/features/stress-test/styles/RlStressTestPage.module.css"
import RlStressTestHistory from "@/features/stress-test/components/RlStressTestHistory"
import { useRef } from "react"

export default function RlStressTestPage() {
    const rl = useRlStressTest()
    const resultRef = useRef<HTMLElement | null>(null)

    async function handleHistorySelect(testId: string) {
        await rl.handleHistorySelect(testId)

        requestAnimationFrame(() => {
            resultRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            })
        })
    }

    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <StressTestModeTabs />

                <header className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>
                            RL DİNAMİK ANALİZ
                        </span>

                        <h1 className={styles.title}>
                            Portföyün stres altında nasıl evrildiğini inceleyin
                        </h1>

                        <p className={styles.description}>
                            Reinforcement Learning modeli, seçilen stres senaryosu
                            boyunca portföy ağırlıklarını dinamik olarak yeniden
                            dengeler ve sonucu pasif portföyle karşılaştırır.
                        </p>
                    </div>
                </header>

                <RlStressTestControls
                    funds={rl.funds}
                    selectedFundId={rl.selectedFundId}
                    selectedScenarioCode={rl.selectedScenarioCode}
                    isLoadingFunds={rl.isLoadingFunds}
                    fundError={rl.fundError}
                    compatibility={rl.compatibility}
                    isCheckingCompatibility={rl.isCheckingCompatibility}
                    compatibilityError={rl.compatibilityError}
                    isRunning={rl.isRunning}
                    canRun={rl.canRun}
                    onFundChange={rl.setSelectedFundId}
                    onScenarioChange={rl.setSelectedScenarioCode}
                    onRun={rl.handleRun}
                />

                {rl.runError ? (
                    <div className={styles.resultError}>
                        {rl.runError}
                    </div>
                ) : null}
                {rl.isHistoryDetailLoading ? (
                    <div className={styles.historyLoading}>
                        Geçmiş RL analizi açılıyor...
                    </div>
                ) : null}


                {rl.result ? (
                    <section
                        ref={resultRef}
                        className={styles.resultSection}
                    >                        <RlStressTestSummary result={rl.result} />

                        <div className={styles.chartCard}>
                            <div className={styles.chartHeader}>
                                <div>
                                    <h2>RL vs Pasif Portföy Değeri</h2>
                                    <p>
                                        Stres dönemi boyunca iki portföyün günlük
                                        NAV gelişimi
                                    </p>
                                </div>
                            </div>

                            <RlNavComparisonChart
                                days={rl.result.days}
                                selectedDayIndex={rl.selectedDayIndex}
                            />
                        </div>

                        {rl.selectedDay ? (
                            <>
                                <RlAnalysisTimeline
                                    day={rl.selectedDay}
                                    dayIndex={rl.selectedDayIndex}
                                    totalDays={rl.result.days.length}
                                    isPlaying={rl.isPlaying}
                                    playbackSpeed={rl.playbackSpeed}
                                    onPrevious={rl.handlePreviousDay}
                                    onNext={rl.handleNextDay}
                                    onDayChange={rl.handleDayChange}
                                    onTogglePlayback={rl.togglePlayback}
                                    onPlaybackSpeedChange={rl.setPlaybackSpeed}
                                />

                                <RlDayAnalysisPanel
                                    currentDay={rl.selectedDay}
                                    previousDay={rl.previousDay}
                                />
                            </>
                        ) : null}

                    </section>
                ) : null}
                <RlStressTestHistory
                    items={rl.history}
                    isLoading={rl.isHistoryLoading}
                    error={rl.historyError}
                    selectedId={rl.selectedHistoryId}
                    deletingId={rl.deletingHistoryId}
                    deleteError={rl.historyDeleteError}
                    onSelect={handleHistorySelect}
                    onDelete={rl.handleHistoryDelete}
                />
            </div>
        </main>
    )
}