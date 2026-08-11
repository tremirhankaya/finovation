import styles from "@/features/stress-test/styles/StressTestDeleteConfirm.module.css"
import Dialog from "@/shared/ui/Dialog"

type Props = {
    open: boolean
    isDeleting: boolean
    onClose: () => void
    onConfirm: () => void
}

export default function RlStressTestDeleteConfirm({
                                                      open,
                                                      isDeleting,
                                                      onClose,
                                                      onConfirm,
                                                  }: Props) {
    return (
        <Dialog
            open={open}
            className={styles.dialog}
            role="alertdialog"
            labelledBy="rl-stress-delete-title"
            describedBy="rl-stress-delete-description"
            isBusy={isDeleting}
            onClose={onClose}
        >
            <h2 id="rl-stress-delete-title">
                RL analizi silinsin mi?
            </h2>

            <p id="rl-stress-delete-description">
                Bu RL stres testi sonucunu geçmişten kaldırmak
                istediğinize emin misiniz?
            </p>

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
                    onClick={onConfirm}
                >
                    {isDeleting ? "Siliniyor…" : "Sil"}
                </button>
            </div>
        </Dialog>
    )
}