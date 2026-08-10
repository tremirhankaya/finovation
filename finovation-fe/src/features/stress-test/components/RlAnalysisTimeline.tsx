import type { RlInferenceDay } from "@/features/stress-test/model/rlStressTest.types"
import styles from "@/features/stress-test/styles/RlStressTestPage.module.css"

type Props = {
    day: RlInferenceDay
    dayIndex: number
    totalDays: number

    isPlaying: boolean
    playbackSpeed: number

    onPrevious: () => void
    onNext: () => void
    onDayChange: (index: number) => void
    onTogglePlayback: () => void
    onPlaybackSpeedChange: (speed: number) => void
}

export default function RlAnalysisTimeline({
                                               day,
                                               dayIndex,
                                               totalDays,
                                               isPlaying,
                                               playbackSpeed,
                                               onPrevious,
                                               onNext,
                                               onDayChange,
                                               onTogglePlayback,
                                               onPlaybackSpeedChange,
                                           }: Props) {
    const difference =
        day.total_new_nav - day.passive_nav

    return (
        <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
                <div>
                    <span className={styles.timelineLabel}>
                        ANALİZ AKIŞI
                    </span>

                    <h2>{formatDate(day.date)}</h2>
                </div>

                <div className={styles.timelineHeaderActions}>
                    <button
                        type="button"
                        className={styles.playbackButton}
                        onClick={onTogglePlayback}
                    >
                        {isPlaying
                            ? "⏸ Duraklat"
                            : "▶ Analizi Oynat"}
                    </button>
                    <select
                        className={styles.speedSelect}
                        value={playbackSpeed}
                        onChange={(event) =>
                            onPlaybackSpeedChange(Number(event.target.value))
                        }
                        aria-label="Oynatma hızı"
                    >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                    </select>

                    <span className={styles.dayCounter}>
                        Gün {dayIndex + 1} / {totalDays}
                    </span>
                </div>
            </div>

            <div className={styles.timelineControls}>
                <button
                    type="button"
                    className={styles.timelineButton}
                    disabled={dayIndex === 0}
                    onClick={onPrevious}
                >
                    ← Önceki Gün
                </button>

                <input
                    className={styles.timelineRange}
                    type="range"
                    min={0}
                    max={Math.max(totalDays - 1, 0)}
                    value={dayIndex}
                    onChange={(event) =>
                        onDayChange(Number(event.target.value))
                    }
                    aria-label="Analiz günü"
                />

                <button
                    type="button"
                    className={styles.timelineButton}
                    disabled={dayIndex === totalDays - 1}
                    onClick={onNext}
                >
                    Sonraki Gün →
                </button>
            </div>

            <div className={styles.selectedDayMetrics}>
                <DayMetric
                    label="RL NAV"
                    value={day.total_new_nav}
                />

                <DayMetric
                    label="Pasif NAV"
                    value={day.passive_nav}
                />

                <DayMetric
                    label="Fark"
                    value={difference}
                />
            </div>
        </div>
    )
}

function DayMetric({
                       label,
                       value,
                   }: {
    label: string
    value: number
}) {
    return (
        <div>
            <span>{label}</span>
            <strong>
                {value.toLocaleString("tr-TR")} ₺
            </strong>
        </div>
    )
}

function formatDate(value: string) {
    return new Date(
        `${value}T00:00:00`,
    ).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}