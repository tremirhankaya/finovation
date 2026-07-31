import styles from "@/pages/users/css/UserDeleteConfirm.module.css"

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
  if (!open) {
    return null
  }

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel()
        }
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
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
      </div>
    </div>
  )
}
