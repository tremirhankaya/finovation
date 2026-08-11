import type { FundDraftSummary } from "@/features/fund-design/api/fundDraftApi"
import Button from "@/shared/ui/Button"
import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/fund-design/styles/FundManagementPage.module.css"

type ResumeDraftsDialogProps = {
  open: boolean
  drafts: FundDraftSummary[]
  totalSteps: number
  onResume: (draftId: string) => void
  onStartNew: () => void
  onClose: () => void
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function ResumeDraftsDialog({
  open,
  drafts,
  totalSteps,
  onResume,
  onStartNew,
  onClose,
}: ResumeDraftsDialogProps) {
  return (
    <Dialog
      open={open}
      className={styles.dialog}
      labelledBy="resume-drafts-title"
      describedBy="resume-drafts-text"
      onClose={onClose}
    >
      <h2 id="resume-drafts-title" className={styles.dialogTitle}>
        Devam eden taslaklarınız var
      </h2>
      <p id="resume-drafts-text" className={styles.dialogText}>
        Yarım kalan {drafts.length} fon tasarımınız var. Devam edebilir ya da
        sıfırdan yeni bir tasarım başlatabilirsiniz.
      </p>

      <ul className={styles.dialogList}>
        {drafts.map((draft) => (
          <li key={draft.draftId}>
            <button
              type="button"
              className={styles.dialogItem}
              onClick={() => onResume(draft.draftId)}
            >
              <span>
                <span className={styles.dialogItemName}>
                  {draft.name ?? "İsimsiz taslak"}
                </span>
                <span className={styles.dialogItemMeta}>
                  Son güncelleme {formatDate(draft.updatedAt)}
                </span>
              </span>
              <span className={[styles.badge, styles.badgeStep].join(" ")}>
                Adım {draft.currentStep ?? 1} / {totalSteps}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.dialogActions}>
        <Button variant="link" onClick={onClose}>
          Vazgeç
        </Button>
        <Button onClick={onStartNew}>Yeni Taslak Başlat</Button>
      </div>
    </Dialog>
  )
}
