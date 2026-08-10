import { useEffect, useState } from "react"

import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/optimization/styles/RejectReasonDialog.module.css"

type RejectReasonDialogProps = {
  open: boolean
  isSubmitting?: boolean
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export default function RejectReasonDialog({
  open,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (open) setReason("")
  }, [open])

  return (
    <Dialog
      open={open}
      className={styles.dialog}
      role="alertdialog"
      labelledBy="reject-reason-title"
      describedBy="reject-reason-desc"
      isBusy={isSubmitting}
      onClose={onCancel}
    >
      <h2 id="reject-reason-title">Optimizasyonu reddet</h2>
      <p id="reject-reason-desc">
        Bu öneri reddedilecek ve fon üzerinde herhangi bir değişiklik
        yapılmayacak. Dilerseniz reddetme gerekçenizi aşağıya yazabilirsiniz;
        bu alan isteğe bağlıdır ve boş bırakılabilir.
      </p>
      <label className={styles.field} htmlFor="reject-reason-input">
        Red gerekçesi (isteğe bağlı)
      </label>
      <textarea
        id="reject-reason-input"
        className={styles.textarea}
        rows={4}
        maxLength={500}
        value={reason}
        disabled={isSubmitting}
        placeholder="Örn. sektör dağılımı hedeflere uymuyor"
        onChange={(event) => setReason(event.target.value)}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ghost}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Vazgeç
        </button>
        <button
          type="button"
          className={styles.danger}
          onClick={() => onConfirm(reason)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Reddediliyor…" : "Reddet"}
        </button>
      </div>
    </Dialog>
  )
}
