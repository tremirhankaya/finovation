import Button from "@/shared/ui/Button"
import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/fund-design/styles/FundManagementPage.module.css"

export type ArchiveTarget = {
  draftId: string
  name: string | null
  isDraft: boolean
}

type ArchiveFundDialogProps = {
  target: ArchiveTarget | null
  isBusy: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ArchiveFundDialog({
  target,
  isBusy,
  onConfirm,
  onClose,
}: ArchiveFundDialogProps) {
  if (!target) return null

  const displayName =
    target.name ?? (target.isDraft ? "İsimsiz taslak" : "İsimsiz fon")

  return (
    <Dialog
      open
      role="alertdialog"
      className={styles.dialog}
      labelledBy="archive-fund-title"
      describedBy="archive-fund-text"
      isBusy={isBusy}
      onClose={onClose}
    >
      <h2 id="archive-fund-title" className={styles.dialogTitle}>
        <strong>{displayName}</strong>{" "}
        {target.isDraft
          ? "taslağını listenizden kaldırmak istiyor musunuz?"
          : "fonunu listenizden kaldırmak istiyor musunuz?"}
      </h2>

      <p id="archive-fund-text" className={styles.dialogNote}>
        <strong>Bu işlem geri alınamaz.</strong> Kaldırılan kayıt tekrar aktif
        hale getirilemez; yalnızca Kaldırılanlar sekmesinde kayıt olarak
        görüntülenir.
      </p>

      <div className={styles.dialogActions}>
        <Button variant="link" onClick={onClose} disabled={isBusy}>
          Vazgeç
        </Button>
        <Button
          className={styles.dangerButton}
          onClick={onConfirm}
          isLoading={isBusy}
          loadingText="Kaldırılıyor…"
        >
          Kaldır
        </Button>
      </div>
    </Dialog>
  )
}
