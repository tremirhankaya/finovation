import { useEffect, useState } from "react"

import FundDesignModeOptions, {
  type FundDesignMode,
} from "@/features/fund-design/components/FundDesignModeOptions"
import Button from "@/shared/ui/Button"
import Dialog from "@/shared/ui/Dialog"
import styles from "@/features/fund-design/styles/FundManagementPage.module.css"

type FundDesignModeDialogProps = {
  open: boolean
  onConfirm: (mode: FundDesignMode) => void
  onClose: () => void
}

export default function FundDesignModeDialog({
  open,
  onConfirm,
  onClose,
}: FundDesignModeDialogProps) {
  const [selectedMode, setSelectedMode] =
    useState<FundDesignMode>("AI_ASSISTED")

  useEffect(() => {
    if (open) setSelectedMode("AI_ASSISTED")
  }, [open])

  return (
    <Dialog
      open={open}
      className={styles.modeDialog}
      labelledBy="fund-design-mode-title"
      describedBy="fund-design-mode-text"
      onClose={onClose}
    >
      <h2 id="fund-design-mode-title" className={styles.dialogTitle}>
        Fonu nasıl oluşturmak istersiniz?
      </h2>
      <p id="fund-design-mode-text" className={styles.dialogText}>
        İki yol da aynı izahname kurallarına uyar. İstediğiniz zaman portföyü
        elinizle düzenleyebilirsiniz.
      </p>

      <FundDesignModeOptions
        selectedMode={selectedMode}
        onSelect={setSelectedMode}
      />

      <div className={styles.dialogActions}>
        <Button variant="link" onClick={onClose}>
          Vazgeç
        </Button>
        <Button onClick={() => onConfirm(selectedMode)}>Devam Et</Button>
      </div>
    </Dialog>
  )
}
