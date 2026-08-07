import { type FormEvent, useEffect, useMemo, useState } from "react"

import {
  formatRoleLabel,
  formatStatusLabel,
} from "@/features/users/lib/userLabels"
import {
  type ProfileFieldErrors,
  validateProfileFields,
} from "@/features/users/lib/userFormValidation"
import PasswordPairFields from "@/features/users/components/PasswordPairFields"
import UserProfileFields from "@/features/users/components/UserProfileFields"
import type { CompanyListItem } from "@/features/users/model/company.types"
import type {
  UpdateUserPayload,
  UserListItem,
  UserRole,
  UserStatus,
} from "@/features/users/model/user.types"
import { getPasswordValidationMessage } from "@/shared/lib/passwordPolicy"
import Dialog from "@/shared/ui/Dialog"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/users/styles/UserFormModal.module.css"

type UserEditModalProps = {
  user: UserListItem | null
  currentUserId: number | null
  open: boolean
  isSaving?: boolean
  error?: Error | null
  actorRole: UserRole
  assignableRoles: UserRole[]
  companies: CompanyListItem[]
  companiesLoading: boolean
  companiesError: string
  onClose: () => void
  onSave: (payload: UpdateUserPayload) => Promise<void> | void
  onErrorDismiss: () => void
  onRetryCompanies: () => void
}

type EditFormState = {
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
  role: UserRole
  status: UserStatus
  companyId: number | null
}

const EMPTY_FORM: EditFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  passwordConfirm: "",
  role: "USER",
  status: "ACTIVE",
  companyId: null,
}

export default function UserEditModal({
  user,
  currentUserId,
  open,
  isSaving = false,
  error = null,
  actorRole,
  assignableRoles,
  companies,
  companiesLoading,
  companiesError,
  onClose,
  onSave,
  onErrorDismiss,
  onRetryCompanies,
}: UserEditModalProps) {
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (!user) return

    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      passwordConfirm: "",
      role: user.role,
      status: user.status,
      companyId: user.companyId,
    })
    setFieldErrors({})
    setResetPasswordOpen(false)
    setSubmitAttempted(false)
  }, [user])

  const isSelf = user?.id === currentUserId

  const roleOptions = useMemo(() => {
    if (!user || isSelf) return user ? [user.role] : []

    return assignableRoles.filter(
      (role) =>
        role !== "ADMIN" ||
        user.role === "ADMIN" ||
        user.companyId === null,
    )
  }, [assignableRoles, isSelf, user])

  const statusOptions = useMemo<UserStatus[]>(() => {
    if (!user) return []
    if (isSelf) return [user.status]

    return user.status === "LOCKED"
      ? ["ACTIVE", "INACTIVE", "LOCKED"]
      : ["ACTIVE", "INACTIVE"]
  }, [isSelf, user])

  if (!user) return null

  const requiresCompanySelection =
    actorRole === "ADMIN" && form.role !== "ADMIN"
  const companySelectionUnavailable =
    requiresCompanySelection && (companiesLoading || companiesError !== "")
  const passwordError = resetPasswordOpen
    ? getPasswordValidationMessage(form.password)
    : null
  const passwordIncomplete =
    resetPasswordOpen &&
    (passwordError !== null || form.password !== form.passwordConfirm)

  const fieldMessage = (field: keyof ProfileFieldErrors) => fieldErrors[field]

  const updateField = <K extends keyof EditFormState,>(
    key: K,
    value: EditFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    onErrorDismiss()
  }

  const handleRoleChange = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      companyId: role === "ADMIN" ? null : current.companyId,
    }))
    setFieldErrors((current) => ({ ...current, companyId: undefined }))
    onErrorDismiss()
  }

  const closePasswordReset = () => {
    setResetPasswordOpen(false)
    setForm((current) => ({
      ...current,
      password: "",
      passwordConfirm: "",
    }))
    onErrorDismiss()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)

    const nextFieldErrors = validateProfileFields(form, {
      requiresCompany: requiresCompanySelection,
    })
    setFieldErrors(nextFieldErrors)

    if (
      Object.keys(nextFieldErrors).length > 0 ||
      passwordIncomplete ||
      companySelectionUnavailable
    ) {
      return
    }

    void onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: resetPasswordOpen ? form.password : undefined,
      role: form.role,
      status: form.status,
      companyId: requiresCompanySelection ? form.companyId : user.companyId,
    })
  }

  return (
    <Dialog
      open={open}
      className={styles.modal}
      labelledBy="edit-user-title"
      describedBy="edit-user-description"
      isBusy={isSaving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.head}>
          <div>
            <h2 id="edit-user-title">Kullanıcıyı Düzenle</h2>
            <p id="edit-user-description">{user.username}</p>
          </div>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        {error && <FormAlert>{error.message}</FormAlert>}

        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-username">
              Kullanıcı adı
            </label>
            <input
              id="edit-username"
              className={styles.input}
              value={user.username}
              disabled
            />
          </div>

          {!requiresCompanySelection && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-company-readonly">
                Şirket
              </label>
              <input
                id="edit-company-readonly"
                className={styles.input}
                value={
                  form.role === "ADMIN" ? "—" : (user.companyName ?? "—")
                }
                disabled
              />
            </div>
          )}
        </div>

        <UserProfileFields
          idPrefix="edit"
          firstName={form.firstName}
          lastName={form.lastName}
          email={form.email}
          errors={{
            firstName: fieldMessage("firstName"),
            lastName: fieldMessage("lastName"),
            email: fieldMessage("email"),
          }}
          disabled={isSaving}
          onChange={updateField}
        />

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
                handleRoleChange(event.target.value as UserRole)
              }
              disabled={isSaving || roleOptions.length === 1}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="edit-status-label">
              Durum <span className={styles.req}>*</span>
            </span>
            <div
              className={styles.statusToggle}
              role="radiogroup"
              aria-labelledby="edit-status-label"
            >
              {statusOptions.map((status) => {
                const selected = form.status === status
                return (
                  <button
                    key={status}
                    className={`${styles.statusOption} ${
                      selected ? styles.statusOptionSelected : ""
                    } ${status === "INACTIVE" ? styles.statusInactive : ""} ${
                      status === "LOCKED" ? styles.statusLocked : ""
                    }`}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isSaving || statusOptions.length === 1}
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

        {requiresCompanySelection && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-company">
              Şirket <span className={styles.req}>*</span>
            </label>
            <select
              id="edit-company"
              className={styles.select}
              value={form.companyId ?? ""}
              onChange={(event) =>
                updateField(
                  "companyId",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              disabled={isSaving || companySelectionUnavailable}
              aria-invalid={Boolean(fieldMessage("companyId"))}
            >
              <option value="">
                {companiesLoading ? "Şirketler yükleniyor…" : "Seçiniz"}
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {companiesError && (
              <p className={styles.fieldError}>
                Şirketler alınamadı.
                <button
                  className={styles.retry}
                  type="button"
                  onClick={onRetryCompanies}
                >
                  Tekrar dene
                </button>
              </p>
            )}
            {!companiesError && fieldMessage("companyId") && (
              <p className={styles.fieldError}>{fieldMessage("companyId")}</p>
            )}
          </div>
        )}

        <section className={styles.security}>
          <div className={styles.securityHead}>
            <h3 className={styles.securityTitle}>Güvenlik</h3>
            {!resetPasswordOpen && (
              <button
                className={styles.securityAction}
                type="button"
                onClick={() => setResetPasswordOpen(true)}
                disabled={isSaving}
              >
                Parolayı sıfırla
              </button>
            )}
          </div>

          {resetPasswordOpen && (
            <div className={styles.securityBody}>
              <PasswordPairFields
                idPrefix="edit"
                passwordLabel="Yeni parola"
                password={form.password}
                passwordConfirm={form.passwordConfirm}
                submitted={submitAttempted}
                disabled={isSaving}
                onChange={updateField}
              />
              <button
                className={styles.securityCancel}
                type="button"
                onClick={closePasswordReset}
                disabled={isSaving}
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
            disabled={isSaving}
          >
            İptal
          </button>
          <button
            className={styles.primary}
            type="submit"
            disabled={
              isSaving || passwordIncomplete || companySelectionUnavailable
            }
          >
            {isSaving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
