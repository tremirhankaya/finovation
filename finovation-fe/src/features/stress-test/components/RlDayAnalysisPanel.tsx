import type { RlInferenceDay } from "@/features/stress-test/model/rlStressTest.types"
import styles from "@/features/stress-test/styles/RlDayAnalysisPanel.module.css"

type Props = {
    currentDay: RlInferenceDay
    previousDay: RlInferenceDay | null
}

type WeightChange = {
    assetCode: string
    previousWeight: number
    currentWeight: number
    change: number
}

const MIN_CHANGE = 0.00001

export default function RlDayAnalysisPanel({
                                               currentDay,
                                               previousDay,
                                           }: Props) {
    const changes = previousDay
        ? getWeightChanges(currentDay, previousDay)
        : []

    const increased = changes.filter(
        (item) => item.change > MIN_CHANGE,
    )

    const decreased = changes.filter(
        (item) => item.change < -MIN_CHANGE,
    )

    return (
        <div className={styles.grid}>
            <section className={styles.card}>
                <span className={styles.eyebrow}>
                    RL PORTFÖY KARARLARI
                </span>

                <h2>Günlük ağırlık değişimleri</h2>

                {!previousDay ? (
                    <p className={styles.empty}>
                        İlk gün için önceki gün karşılaştırması bulunmuyor.
                    </p>
                ) : (
                    <div className={styles.changeGroups}>
                        <ChangeGroup
                            title="Artırılan pozisyonlar"
                            items={increased}
                            direction="increase"
                        />

                        <ChangeGroup
                            title="Azaltılan pozisyonlar"
                            items={decreased}
                            direction="decrease"
                        />
                    </div>
                )}
            </section>

            <section className={styles.card}>
                <span className={styles.eyebrow}>
                    PORTFÖY DAĞILIMI
                </span>

                <h2>Seçili gün ağırlıkları</h2>

                <div className={styles.list}>
                    {Object.entries(currentDay.weights)
                        .sort(
                            ([, left], [, right]) =>
                                right - left,
                        )
                        .map(([assetCode, weight]) => (
                            <div
                                key={assetCode}
                                className={styles.allocationRow}
                            >
                                <div className={styles.allocationLabel}>
                                    <span>
                                        {formatAssetCode(assetCode)}
                                    </span>

                                    <strong>
                                        {formatPercent(weight)}
                                    </strong>
                                </div>

                                <div className={styles.track}>
                                    <div
                                        className={styles.fill}
                                        style={{
                                            width: `${weight * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                </div>
            </section>
        </div>
    )
}

function ChangeGroup({
                         title,
                         items,
                         direction,
                     }: {
    title: string
    items: WeightChange[]
    direction: "increase" | "decrease"
}) {
    return (
        <div className={styles.changeGroup}>
            <div className={styles.changeGroupHeader}>
                <span>{title}</span>

                <strong>{items.length}</strong>
            </div>

            {items.length === 0 ? (
                <p className={styles.empty}>
                    Bu gün için değişiklik bulunmuyor.
                </p>
            ) : (
                <div className={styles.list}>
                    {items.map((item) => (
                        <div
                            key={item.assetCode}
                            className={styles.decisionRow}
                        >
                            <div>
                                <strong>
                                    {formatAssetCode(item.assetCode)}
                                </strong>

                                <span className={styles.weightTransition}>
                                    {formatPercent(item.previousWeight)}
                                    {" → "}
                                    {formatPercent(item.currentWeight)}
                                </span>
                            </div>

                            <b
                                className={
                                    direction === "increase"
                                        ? styles.positive
                                        : styles.negative
                                }
                            >
                                {item.change > 0 ? "+" : ""}
                                {(item.change * 100).toFixed(2)} puan
                            </b>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function getWeightChanges(
    currentDay: RlInferenceDay,
    previousDay: RlInferenceDay,
): WeightChange[] {
    return Object.entries(currentDay.weights)
        .map(([assetCode, currentWeight]) => {
            const previousWeight =
                previousDay.weights[assetCode] ?? currentWeight

            return {
                assetCode,
                previousWeight,
                currentWeight,
                change: currentWeight - previousWeight,
            }
        })
        .sort(
            (left, right) =>
                Math.abs(right.change) -
                Math.abs(left.change),
        )
}

function formatAssetCode(assetCode: string) {
    return assetCode === "CASH_TPP"
        ? "CASH / TPP"
        : assetCode
}

function formatPercent(value: number) {
    return `%${(value * 100).toFixed(2)}`
}