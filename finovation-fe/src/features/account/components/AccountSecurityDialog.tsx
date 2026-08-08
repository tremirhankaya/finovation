import { type FormEvent, useEffect, useState } from "react"

import { changePassword } from "@/features/account/api/accountService"
import { isPasswordChangeValid } from "@/features/account/model/passwordChange"
import type { MeResponse } from "@/features/auth/model/auth.types"
import Dialog from "@/shared/ui/Dialog"
import FormAlert from "@/shared/ui/FormAlert"
import PasswordPairFields from "@/shared/ui/PasswordPairFields"
import styles from "@/features/account/styles/AccountSecurityDialog.module.css"

type AccountSecurityDialogProps = {
  open: boolean
  user: MeResponse
  roleLabel: string
  initialPasswordFormOpen?: boolean
  onClose: () => void
  onPasswordChanged: () => Promise<void> | void
}

export default function AccountSecurityDialog({
  open,
  user,
  roleLabel,
  initialPasswordFormOpen = false,
  onClose,
  onPasswordChanged,
}: AccountSecurityDialogProps) {
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(
    initialPasswordFormOpen,
  )

  useEffect(() => {
    if (!open) return
    setNewPassword("")
    setNewPasswordConfirm("")
    setSubmitted(false)
    setIsSaving(false)
    setError("")
    setIsPasswordFormOpen(initialPasswordFormOpen)
  }, [initialPasswordFormOpen, open])

  const handleClose = () => {
    if (!isSaving) onClose()
  }

  const handlePasswordChange = (
    field: "password" | "passwordConfirm",
    value: string,
  ) => {
    if (field === "password") {
      setNewPassword(value)
    } else {
      setNewPasswordConfirm(value)
    }
    setError("")
  }

  const closePasswordForm = () => {
    setNewPassword("")
    setNewPasswordConfirm("")
    setSubmitted(false)
    setError("")
    setIsPasswordFormOpen(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setError("")

    const payload = { newPassword, newPasswordConfirm }
    if (!isPasswordChangeValid(payload)) return

    setIsSaving(true)
    try {
      await changePassword(payload)
      await onPasswordChanged()
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "Parola değiştirilemedi.",
      )
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      className={styles.dialog}
      labelledBy="account-security-title"
      describedBy="account-security-description"
      isBusy={isSaving}
      onClose={handleClose}
    >
      <div className={styles.header}>
        <div>
          <h2 id="account-security-title">Hesap ve Güvenlik</h2>
          <p id="account-security-description">
            Hesap bilgilerinizi görüntüleyin ve parolanızı değiştirin.
          </p>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Kapat"
          disabled={isSaving}
          onClick={handleClose}
        >
          ×
        </button>
      </div>

      <section className={styles.section} aria-labelledby="account-info-title">
        <h3 id="account-info-title">Hesap Bilgileri</h3>
        <dl className={styles.profileGrid}>
          <div>
            <dt>Ad</dt>
            <dd>{user.firstName}</dd>
          </div>
          <div>
            <dt>Soyad</dt>
            <dd>{user.lastName}</dd>
          </div>
          <div>
            <dt>E-posta</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Kullanıcı adı</dt>
            <dd>{user.username}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{roleLabel}</dd>
          </div>
          <div>
            <dt>Şirket</dt>
            <dd>{user.companyName ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.securitySection}
        aria-labelledby="password-title"
      >
        <div className={styles.securityHeader}>
          <div>
            <h3 id="password-title">Parola</h3>
            <p>
              Parola değişikliğinden sonra güvenliğiniz için yeniden giriş
              yapmanız gerekir.
            </p>
          </div>
          {!isPasswordFormOpen && (
            <button
              type="button"
              className={styles.changePasswordButton}
              onClick={() => setIsPasswordFormOpen(true)}
            >
              Parolayı değiştir
            </button>
          )}
        </div>

        {isPasswordFormOpen && (
          <form
            className={styles.passwordForm}
            onSubmit={handleSubmit}
            noValidate
          >
            {error && (
              <div className={styles.alert}>
                <FormAlert>{error}</FormAlert>
              </div>
            )}

            <PasswordPairFields
              idPrefix="account"
              passwordLabel="Yeni parola"
              password={newPassword}
              passwordConfirm={newPasswordConfirm}
              submitted={submitted}
              disabled={isSaving}
              onChange={handlePasswordChange}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isSaving}
                onClick={closePasswordForm}
              >
                Geri
              </button>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={isSaving}
              >
                {isSaving ? "Değiştiriliyor…" : "Parolayı değiştir"}
              </button>
            </div>
          </form>
        )}
      </section>
    </Dialog>
  )
}
