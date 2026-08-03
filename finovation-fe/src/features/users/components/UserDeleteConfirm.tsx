import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/users/styles/UserDeleteConfirm.module.css"

type UserDeleteConfirmProps = {
  username: string
  open: boolean
  isDeleting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function UserDeleteConfirm({
  username,
  open,
  isDeleting = false,
  onCancel,
  onConfirm,
}: UserDeleteConfirmProps) {
  return (
    <Dialog
      open={open}
      className={styles.dialog}
      role="alertdialog"
      labelledBy="delete-title"
      describedBy="delete-desc"
      isBusy={isDeleting}
      onClose={onCancel}
    >
      <h2 id="delete-title">Kullanıcıyı sil</h2>
      <p id="delete-desc">
        <strong>{username}</strong> kullanıcısını silmek istediğinize emin
        misiniz? Bu işlem geri alınamaz.
      </p>
      <div className={styles.actions}>
        <button
          className={styles.ghost}
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Vazgeç
        </button>
        <button
          className={styles.danger}
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? "Siliniyor…" : "Sil"}
        </button>
      </div>
    </Dialog>
  )
}
