import { useEffect, useState } from "react"

import EyeIcon from "@/assets/icons/EyeIcon"
import FormAlert from "@/component/FormAlert"
import type { CompanyListItem } from "@/type/company.types"
import type { CreateUserPayload, UserRole } from "@/type/user.types"
import { formatRoleLabel } from "@/util/userLabels"
import {
  getPasswordValidationMessage,
  PASSWORD_RULES_HELP,
} from "@/util/passwordPolicy"
import styles from "@/pages/users/css/UserCreateModal.module.css"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type UserCreateModalProps = {
  open: boolean
  isSaving?: boolean
  error?: string
  assignableRoles: UserRole[]
  companies: CompanyListItem[]
  actorRole: UserRole
  onClose: () => void
  onCreate: (payload: CreateUserPayload) => Promise<void> | void
}

type CreateFormState = {
  username: string
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
  role: UserRole
  companyId: number | null
}

type FieldErrors = {
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  companyId?: string
}

function buildEmptyForm(defaultRole: UserRole): CreateFormState {
  return {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    role: defaultRole,
    companyId: null,
  }
}

function validateFields(
  form: CreateFormState,
  requiresCompany: boolean,
): FieldErrors {
  const errors: FieldErrors = {}
  const username = form.username.trim()
  const firstName = form.firstName.trim()
  const lastName = form.lastName.trim()
  const email = form.email.trim()

  if (!username) {
    errors.username = "Kullanıcı adı zorunludur."
  }

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

  if (requiresCompany && form.companyId == null) {
    errors.companyId = "Şirket seçimi zorunludur."
  }

  return errors
}

export default function UserCreateModal({
  open,
  isSaving = false,
  error = "",
  assignableRoles,
  companies,
  actorRole,
  onClose,
  onCreate,
}: UserCreateModalProps) {
  const [form, setForm] = useState<CreateFormState>(
    buildEmptyForm(assignableRoles[0] ?? "USER"),
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(buildEmptyForm(assignableRoles[0] ?? "USER"))
      setFieldErrors({})
      setPasswordVisible(false)
      setPasswordConfirmVisible(false)
      setSubmitAttempted(false)
    }
  }, [open])

  if (!open) {
    return null
  }

  const isBusy = isSaving
  const trimmedPassword = form.password.trim()
  const trimmedConfirm = form.passwordConfirm.trim()
  const requiresCompany = actorRole !== "ADMIN" && form.role !== "SUPER_ADMIN"

  const passwordError = getPasswordValidationMessage(trimmedPassword)
  const showPasswordError =
    (submitAttempted || trimmedPassword.length > 0) && passwordError !== null
  const passwordMismatch =
    (submitAttempted || trimmedConfirm.length > 0) &&
    trimmedPassword !== trimmedConfirm
  const passwordIncomplete =
    passwordError !== null || trimmedPassword !== trimmedConfirm

  const updateField = <K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key !== "password" && key !== "passwordConfirm") {
      setFieldErrors((current) => ({ ...current, [key]: undefined }))
    }
  }

  const handleCreate = () => {
    setSubmitAttempted(true)
    const nextFieldErrors = validateFields(form, requiresCompany)
    setFieldErrors(nextFieldErrors)

    if (Object.keys(nextFieldErrors).length > 0 || passwordIncomplete) {
      return
    }

    void onCreate({
      username: form.username.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: trimmedPassword,
      role: form.role,
      companyId: requiresCompany ? form.companyId : null,
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
        aria-labelledby="create-title"
      >
        <div className={styles.head}>
          <div>
            <h2 id="create-title">Yeni Kullanıcı</h2>
            <p>Yeni bir kullanıcı hesabı oluşturun.</p>
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
            <label className={styles.label} htmlFor="create-username">
              Kullanıcı adı <span className={styles.req}>*</span>
            </label>
            <input
              id="create-username"
              className={styles.input}
              type="text"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              disabled={isBusy}
              autoComplete="off"
            />
            {fieldErrors.username && (
              <p className={styles.fieldError}>{fieldErrors.username}</p>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-role">
              Rol <span className={styles.req}>*</span>
            </label>
            <select
              id="create-role"
              className={styles.select}
              value={form.role}
              onChange={(event) =>
                updateField("role", event.target.value as UserRole)
              }
              disabled={isBusy}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-first">
              Ad <span className={styles.req}>*</span>
            </label>
            <input
              id="create-first"
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
            <label className={styles.label} htmlFor="create-last">
              Soyad <span className={styles.req}>*</span>
            </label>
            <input
              id="create-last"
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
          <label className={styles.label} htmlFor="create-email">
            E-posta <span className={styles.req}>*</span>
          </label>
          <input
            id="create-email"
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

        {requiresCompany && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="create-company">
              Şirket <span className={styles.req}>*</span>
            </label>
            <select
              id="create-company"
              className={styles.select}
              value={form.companyId ?? ""}
              onChange={(event) =>
                updateField(
                  "companyId",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              disabled={isBusy}
            >
              <option value="">Seçiniz</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {fieldErrors.companyId && (
              <p className={styles.fieldError}>{fieldErrors.companyId}</p>
            )}
          </div>
        )}

        <section className={styles.security}>
          <div className={styles.securityHead}>
            <h3 className={styles.securityTitle}>Parola</h3>
          </div>
          <div className={styles.securityBody}>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="create-password">
                  Parola <span className={styles.req}>*</span>
                </label>
                <div className={styles.passwordControl}>
                  <input
                    id="create-password"
                    className={styles.input}
                    type={passwordVisible ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    autoComplete="new-password"
                    disabled={isBusy}
                  />
                  <button
                    className={styles.reveal}
                    type="button"
                    onClick={() => setPasswordVisible((current) => !current)}
                    aria-label={
                      passwordVisible ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                    aria-pressed={passwordVisible}
                    disabled={isBusy}
                  >
                    <EyeIcon visible={passwordVisible} />
                  </button>
                </div>
                {showPasswordError && (
                  <p className={styles.fieldError}>{passwordError}</p>
                )}
              </div>
              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="create-password-confirm"
                >
                  Parola tekrar <span className={styles.req}>*</span>
                </label>
                <div className={styles.passwordControl}>
                  <input
                    id="create-password-confirm"
                    className={styles.input}
                    type={passwordConfirmVisible ? "text" : "password"}
                    value={form.passwordConfirm}
                    onChange={(event) =>
                      updateField("passwordConfirm", event.target.value)
                    }
                    autoComplete="new-password"
                    disabled={isBusy}
                  />
                  <button
                    className={styles.reveal}
                    type="button"
                    onClick={() =>
                      setPasswordConfirmVisible((current) => !current)
                    }
                    aria-label={
                      passwordConfirmVisible ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                    aria-pressed={passwordConfirmVisible}
                    disabled={isBusy}
                  >
                    <EyeIcon visible={passwordConfirmVisible} />
                  </button>
                </div>
                {passwordMismatch && (
                  <p className={styles.fieldError}>Parolalar eşleşmiyor.</p>
                )}
              </div>
            </div>
            <p className={styles.help}>{PASSWORD_RULES_HELP}</p>
          </div>
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
            onClick={handleCreate}
            disabled={isBusy}
          >
            {isSaving ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  )
}
