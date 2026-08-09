import { useEffect, useState } from "react"

import { getUserFunds } from "@/features/users/api/userFundService"
import type { UserListItem } from "@/features/users/model/user.types"
import type { UserFund } from "@/features/users/model/userFund.types"
import styles from "@/features/users/styles/UserFundsDialog.module.css"
import Dialog from "@/shared/ui/Dialog"

type UserFundsDialogProps = {
  open: boolean
  user: UserListItem | null
  onClose: () => void
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

export default function UserFundsDialog({
  open,
  user,
  onClose,
}: UserFundsDialogProps) {
  const [funds, setFunds] = useState<UserFund[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!open || !user) return

    const controller = new AbortController()
    setIsLoading(true)
    setError("")

    void getUserFunds(user.id, controller.signal)
      .then(setFunds)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setFunds([])
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Kullanıcının fonları alınamadı.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [open, reloadKey, user])

  return (
    <Dialog
      open={open}
      className={styles.dialog}
      labelledBy="user-funds-title"
      describedBy="user-funds-description"
      onClose={onClose}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Kullanıcı portföyü</p>
          <h2 id="user-funds-title">{user?.fullName ?? "Kullanıcı"} fonları</h2>
          <p id="user-funds-description">
            {user?.username ? `@${user.username}` : "Seçili kullanıcı"} adına
            oluşturulmuş tamamlanmış fonlar.
          </p>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Kapat"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className={styles.body}>
        {isLoading && (
          <p className={styles.state} role="status">
            Fonlar yükleniyor…
          </p>
        )}

        {!isLoading && error && (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!isLoading && !error && funds.length === 0 && (
          <div className={styles.empty}>
            <span aria-hidden="true">◇</span>
            <strong>Henüz tamamlanmış fon bulunmuyor</strong>
            <p>
              Bu kullanıcı bir fon oluşturup tamamladığında burada görünecek.
            </p>
          </div>
        )}

        {!isLoading && !error && funds.length > 0 && (
          <ul className={styles.fundList}>
            {funds.map((fund) => (
              <li key={fund.id}>
                <span className={styles.fundIcon} aria-hidden="true">
                  F
                </span>
                <span className={styles.fundDetails}>
                  <strong>{fund.name}</strong>
                  <small>Hisse Yoğun Fon · {fund.currency}</small>
                </span>
                <span className={styles.date}>
                  <small>Oluşturulma</small>
                  <time dateTime={fund.inceptionDate}>
                    {formatDate(fund.inceptionDate)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className={styles.footer}>
        <button type="button" onClick={onClose}>
          Kapat
        </button>
      </footer>
    </Dialog>
  )
}
