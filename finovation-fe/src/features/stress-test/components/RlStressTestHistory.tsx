import { useState } from "react"

import RlStressTestDeleteConfirm from "@/features/stress-test/components/RlStressTestDeleteConfirm"
import type { RlStressTestHistoryItem } from "@/features/stress-test/model/rlStressTest.types"
import styles from "@/features/stress-test/styles/RlStressTestHistory.module.css"

type Props = {
    items: RlStressTestHistoryItem[]
    isLoading: boolean
    error: string
    selectedId: string | null
    deletingId: string | null
    deleteError: string
    onSelect: (testId: string) => void
    onDelete: (testId: string) => void
}

export default function RlStressTestHistory({
                                                items,
                                                isLoading,
                                                error,
                                                selectedId,
                                                deletingId,
                                                deleteError,
                                                onSelect,
                                                onDelete,
                                            }: Props) {
    const [deleteTargetId, setDeleteTargetId] =
        useState<string | null>(null)

    function handleConfirmDelete() {
        if (!deleteTargetId) return

        onDelete(deleteTargetId)
        setDeleteTargetId(null)
    }

    if (isLoading) {
        return (
            <section className={styles.card}>
                <p className={styles.message}>
                    RL analiz geçmişi yükleniyor...
                </p>
            </section>
        )
    }

    if (error) {
        return (
            <section className={styles.card}>
                <p className={styles.error}>
                    {error}
                </p>
            </section>
        )
    }

    return (
        <>
            <section className={styles.card}>
                <div className={styles.header}>
                    <div>
                        <span className={styles.eyebrow}>
                            GEÇMİŞ RL ANALİZLERİ
                        </span>

                        <h2>Analiz geçmişi</h2>
                    </div>

                    {items.length > 0 ? (
                        <span className={styles.count}>
                            {items.length} analiz
                        </span>
                    ) : null}
                </div>

                {deleteError ? (
                    <p className={styles.error}>
                        {deleteError}
                    </p>
                ) : null}

                {items.length === 0 ? (
                    <p className={styles.message}>
                        Henüz kayıtlı RL analizi bulunmuyor.
                    </p>
                ) : (
                    <div className={styles.list}>
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={`${styles.row} ${
                                    selectedId === item.id
                                        ? styles.selectedRow
                                        : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className={styles.rowContent}
                                    onClick={() => onSelect(item.id)}
                                >
                                    <div className={styles.main}>
                                        <strong>
                                            {formatScenario(
                                                item.scenarioCode,
                                            )}
                                        </strong>

                                        <span>
                                            {formatDate(item.createdAt)}
                                        </span>
                                    </div>

                                    <div className={styles.metrics}>
                                        <div>
                                            <span>RL Getiri</span>
                                            <strong>
                                                {formatPercent(
                                                    item.returnPct,
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Pasif</span>
                                            <strong>
                                                {formatPercent(
                                                    item.passiveReturnPct,
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Avantaj</span>
                                            <strong
                                                className={
                                                    styles.outperformance
                                                }
                                            >
                                                {formatSignedPercent(
                                                    item.outperformancePct,
                                                )}
                                            </strong>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    className={styles.deleteButton}
                                    disabled={
                                        deletingId === item.id
                                    }
                                    onClick={() =>
                                        setDeleteTargetId(item.id)
                                    }
                                >
                                    {deletingId === item.id
                                        ? "Siliniyor..."
                                        : "Sil"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <RlStressTestDeleteConfirm
                open={Boolean(deleteTargetId)}
                isDeleting={
                    deletingId === deleteTargetId
                }
                onClose={() => setDeleteTargetId(null)}
                onConfirm={handleConfirmDelete}
            />
        </>
    )
}

function formatPercent(value: number) {
    return `%${value.toFixed(2)}`
}

function formatSignedPercent(value: number) {
    const sign = value > 0 ? "+" : ""

    return `${sign}%${value.toFixed(2)}`
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatScenario(code: string) {
    if (code === "SCENARIO_1_2025_03_17") {
        return "2025 İmamoğlu Politik Şoku"
    }

    if (code === "SCENARIO_2_2025_06_30") {
        return "Uzayan Politik Belirsizlik"
    }

    return code
}