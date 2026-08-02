import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/users/styles/UserErrorDialog.module.css"

type UserErrorDialogProps = {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}

export default function UserErrorDialog({
  open,
  title = "İşlem tamamlanamadı",
  message,
  onClose,
}: UserErrorDialogProps) {
  return (
    <Dialog
      open={open}
      className={styles.dialog}
      role="alertdialog"
      labelledBy="user-error-title"
      describedBy="user-error-desc"
      onClose={onClose}
    >
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className={styles.copy}>
          <h2 id="user-error-title">{title}</h2>
          <p id="user-error-desc">{message}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={onClose}>
          Tamam
        </button>
      </div>
    </Dialog>
  )
}
