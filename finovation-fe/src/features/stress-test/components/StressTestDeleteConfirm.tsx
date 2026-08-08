import { useState } from "react"

import { deleteStressTest } from "@/features/stress-test/api/stressTestService"
import styles from "@/features/stress-test/styles/StressTestDeleteConfirm.module.css"
import Dialog from "@/shared/ui/Dialog"

type StressTestDeleteConfirmProps = {
    testId: string | null
    onClose: () => void
    onDeleted: (testId: string) => void
}

export default function StressTestDeleteConfirm({
                                                    testId,
                                                    onClose,
                                                    onDeleted,
                                                }: StressTestDeleteConfirmProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")

    async function handleDelete() {
        if (!testId || isDeleting) return

        setIsDeleting(true)
        setErrorMessage("")

        try {
            await deleteStressTest(testId)
            onDeleted(testId)
            onClose()
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Stres testi silinemedi.",
            )
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog
            open={Boolean(testId)}
            className={styles.dialog}
            role="alertdialog"
            labelledBy="stress-delete-title"
            describedBy="stress-delete-description"
            isBusy={isDeleting}
            onClose={onClose}
        >
            <h2 id="stress-delete-title">Stres testi silinsin mi?</h2>

            <p id="stress-delete-description">
                Bu stres testi sonucunu geçmişten kaldırmak istediğinize emin
                misiniz?
            </p>

            {errorMessage && (
                <div className={styles.error} role="alert">
                    {errorMessage}
                </div>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onClose}
                >
                    Vazgeç
                </button>

                <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={isDeleting}
                    onClick={() => void handleDelete()}
                >
                    {isDeleting ? "Siliniyor…" : "Sil"}
                </button>
            </div>
        </Dialog>
    )
}