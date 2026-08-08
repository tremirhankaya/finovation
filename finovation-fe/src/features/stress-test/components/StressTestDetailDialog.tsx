import { useEffect, useState } from "react"

import { fetchStressTestDetail } from "@/features/stress-test/api/stressTestService"
import StressTestResultView from "@/features/stress-test/components/StressTestResultView"
import type { StressTestDetailResponse } from "@/features/stress-test/model/stressTestSchemas"
import styles from "@/features/stress-test/styles/StressTestDetailDialog.module.css"
import Dialog from "@/shared/ui/Dialog"

type StressTestDetailDialogProps = {
    testId: string | null
    onClose: () => void
}

export default function StressTestDetailDialog({
                                                   testId,
                                                   onClose,
                                               }: StressTestDetailDialogProps) {
    const [detail, setDetail] = useState<StressTestDetailResponse | null>(null)
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        if (!testId) {
            setDetail(null)
            setErrorMessage("")
            return
        }

        const controller = new AbortController()

        setDetail(null)
        setErrorMessage("")

        fetchStressTestDetail(testId, controller.signal)
            .then(setDetail)
            .catch((error) => {
                if (controller.signal.aborted) return

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Stres testi detayı yüklenemedi.",
                )
            })

        return () => controller.abort()
    }, [testId])

    return (
        <Dialog
            open={Boolean(testId)}
            className={styles.dialog}
            labelledBy="stress-detail-title"
            onClose={onClose}
        >
            <div className={styles.header}>
                <div>
                    <span>Geçmiş Stres Testi</span>
                    <h2 id="stress-detail-title">
                        {detail?.scenarioName ?? "Test detayı"}
                    </h2>
                </div>

                <button type="button" onClick={onClose}>
                    Kapat
                </button>
            </div>

            {errorMessage && (
                <div className={styles.error} role="alert">
                    {errorMessage}
                </div>
            )}

            {!detail && !errorMessage && (
                <div className={styles.loading} role="status">
                    Detay yükleniyor…
                </div>
            )}

            {detail && (
                <div className={styles.content}>
                    <StressTestResultView result={detail} />
                </div>
            )}
        </Dialog>
    )
}