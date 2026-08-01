import { useEffect, useState } from "react"

import FormAlert from "@/component/FormAlert"
import type {
  UpdateUserPayload,
  UserListItem,
  UserRole,
  UserStatus,
} from "@/type/user.types"
import { formatRoleLabel, formatStatusLabel } from "@/util/userLabels"
import {
  getPasswordValidationMessage,
  PASSWORD_RULES_HELP,
} from "@/util/passwordPolicy"
import styles from "@/pages/users/css/UserEditModal.module.css"

const ROLE_OPTIONS: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"]
const STATUS_OPTIONS: UserStatus[] = ["ACTIVE", "INACTIVE"]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserEditModalProps = {
  user: UserListItem | null
  open: boolean
  isSaving?: boolean
  error?: string
  onClose: () => void
  onSave: (payload: UpdateUserPayload) => Promise<void> | void
}

type EditFormState = {
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
  role: UserRole
  status: UserStatus
}

type FieldErrors = {
  firstName?: string
  lastName?: string
  email?: string
}

function validateProfileFields(form: EditFormState): FieldErrors {
  const errors: FieldErrors = {}
  const firstName = form.firstName.trim()
  const lastName = form.lastName.trim()
  const email = form.email.trim()

  if (!firstName) {
    errors.firstName = "Ad zorunludur."
  }

  if (!lastName) {
    errors.lastName = "Soyad zorunludur."
  }

  if (!email) {
    errors.email = "E-posta zorunludur."
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Geçerli bir e-posta girin."
  }

  return errors
}

export default function UserEditModal({
  user,
  open,
  isSaving = false,
  error = "",
  onClose,
  onSave,
}: UserEditModalProps) {
  const [form, setForm] = useState<EditFormState>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    role: "USER",
    status: "ACTIVE",
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }

    setForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      password: "",
      passwordConfirm: "",
      role: user.role,
      status: user.status ?? "ACTIVE",
    })
    setFieldErrors({})
    setResetPasswordOpen(false)
  }, [user])

  if (!open || !user) {
    return null
  }

  const isBusy = isSaving
  const trimmedPassword = form.password.trim()
  const trimmedConfirm = form.passwordConfirm.trim()

  const passwordError = resetPasswordOpen
    ? getPasswordValidationMessage(trimmedPassword)
    : null
  const passwordMismatch =
    resetPasswordOpen &&
    trimmedConfirm.length > 0 &&
    trimmedPassword !== trimmedConfirm
  const passwordIncomplete =
    resetPasswordOpen &&
    (passwordError !== null || trimmedPassword !== trimmedConfirm)

  const updateField = <K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === "firstName" || key === "lastName" || key === "email") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }))
    }
  }

  const closePasswordReset = () => {
    setResetPasswordOpen(false)
    setForm((current) => ({
      ...current,
      password: "",
      passwordConfirm: "",
    }))
  }

  const handleSave = () => {
    const nextFieldErrors = validateProfileFields(form)
    setFieldErrors(nextFieldErrors)

    if (Object.keys(nextFieldErrors).length > 0 || passwordIncomplete) {
      return
    }

    void onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: resetPasswordOpen ? trimmedPassword : undefined,
      role: form.role,
      status: form.status,
      companyId: user.companyId,
    })
  }

  return (
      <div
        className={styles.overlay}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isBusy) {
            onClose()
          }
        }}
      >
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-title"
        >
          <div className={styles.head}>
            <div>
              <h2 id="edit-title">Kullanıcıyı Düzenle</h2>
              <p>{user.username}</p>
            </div>
            <button
              className={styles.close}
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              disabled={isBusy}
            >
              ×
            </button>
          </div>

          {error && <FormAlert>{error}</FormAlert>}

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-username">
                Kullanıcı adı
              </label>
              <input
                id="edit-username"
                className={styles.input}
                type="text"
                value={user.username}
                disabled
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-company">
                Şirket
              </label>
              <input
                id="edit-company"
                className={styles.input}
                type="text"
                value={user.companyName ?? "—"}
                disabled
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-first">
                Ad <span className={styles.req}>*</span>
              </label>
              <input
                id="edit-first"
                className={styles.input}
                type="text"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                disabled={isBusy}
              />
              {fieldErrors.firstName && (
                <p className={styles.fieldError}>{fieldErrors.firstName}</p>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-last">
                Soyad <span className={styles.req}>*</span>
              </label>
              <input
                id="edit-last"
                className={styles.input}
                type="text"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                disabled={isBusy}
              />
              {fieldErrors.lastName && (
                <p className={styles.fieldError}>{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-email">
              E-posta <span className={styles.req}>*</span>
            </label>
            <input
              id="edit-email"
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="ornek@infina.com"
              disabled={isBusy}
            />
            {fieldErrors.email && (
              <p className={styles.fieldError}>{fieldErrors.email}</p>
            )}
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-role">
                Rol <span className={styles.req}>*</span>
              </label>
              <select
                id="edit-role"
                className={styles.select}
                value={form.role}
                onChange={(event) =>
                  updateField("role", event.target.value as UserRole)
                }
                disabled={isBusy}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {formatRoleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <p className={styles.label} id="edit-status-label">
                Durum <span className={styles.req}>*</span>
              </p>
              <div
                className={styles.statusToggle}
                role="radiogroup"
                aria-labelledby="edit-status-label"
              >
                {STATUS_OPTIONS.map((status) => {
                  const selected = form.status === status
                  return (
                    <button
                      key={status}
                      className={`${styles.statusOption} ${selected ? styles.statusOptionSelected : ""} ${status === "ACTIVE" ? styles.statusActive : styles.statusInactive}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={isBusy}
                      onClick={() => updateField("status", status)}
                    >
                      <span className={styles.statusDot} aria-hidden="true" />
                      {formatStatusLabel(status)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <section className={styles.security}>
            <div className={styles.securityHead}>
              <h3 className={styles.securityTitle}>Güvenlik</h3>
              {!resetPasswordOpen && (
                <button
                  className={styles.securityAction}
                  type="button"
                  onClick={() => setResetPasswordOpen(true)}
                  disabled={isBusy}
                >
                  Parolayı sıfırla
                </button>
              )}
            </div>

            {resetPasswordOpen && (
              <div className={styles.securityBody}>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="edit-password">
                      Yeni parola <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="edit-password"
                      className={styles.input}
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                      autoComplete="new-password"
                      disabled={isBusy}
                    />
                    {trimmedPassword.length > 0 && passwordError && (
                      <p className={styles.fieldError}>{passwordError}</p>
                    )}
                  </div>
                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor="edit-password-confirm"
                    >
                      Parola tekrar <span className={styles.req}>*</span>
                    </label>
                    <input
                      id="edit-password-confirm"
                      className={styles.input}
                      type="password"
                      value={form.passwordConfirm}
                      onChange={(event) =>
                        updateField("passwordConfirm", event.target.value)
                      }
                      autoComplete="new-password"
                      disabled={isBusy}
                    />
                    {passwordMismatch && (
                      <p className={styles.fieldError}>Parolalar eşleşmiyor.</p>
                    )}
                  </div>
                </div>
                <p className={styles.help}>{PASSWORD_RULES_HELP}</p>
                <button
                  className={styles.securityCancel}
                  type="button"
                  onClick={closePasswordReset}
                  disabled={isBusy}
                >
                  Parola sıfırlamayı iptal et
                </button>
              </div>
            )}
          </section>

          <div className={styles.actions}>
            <button
              className={styles.ghost}
              type="button"
              onClick={onClose}
              disabled={isBusy}
            >
              İptal
            </button>
            <button
              className={styles.primary}
              type="button"
              onClick={handleSave}
              disabled={isBusy || passwordIncomplete}
            >
              {isSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
  )
}
