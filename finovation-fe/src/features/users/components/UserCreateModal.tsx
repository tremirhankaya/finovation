import { type FormEvent, useEffect, useState } from "react"

import { formatRoleLabel } from "@/features/users/lib/userLabels"
import {
  type ProfileFieldErrors,
  USERNAME_MAX_LENGTH,
  validateProfileFields,
} from "@/features/users/lib/userFormValidation"
import PasswordPairFields from "@/shared/ui/PasswordPairFields"
import UserProfileFields from "@/features/users/components/UserProfileFields"
import type { CompanyListItem } from "@/features/users/model/company.types"
import type {
  CreateUserPayload,
  UserRole,
} from "@/features/users/model/user.types"
import { getPasswordValidationMessage } from "@/shared/lib/passwordPolicy"
import Dialog from "@/shared/ui/Dialog"
import FormAlert from "@/shared/ui/FormAlert"
import styles from "@/features/users/styles/UserFormModal.module.css"

type UserCreateModalProps = {
  open: boolean
  isSaving?: boolean
  error?: Error | null
  assignableRoles: UserRole[]
  companies: CompanyListItem[]
  companiesLoading: boolean
  companiesError: string
  actorRole: UserRole
  onClose: () => void
  onCreate: (payload: CreateUserPayload) => Promise<void> | void
  onErrorDismiss: () => void
  onRetryCompanies: () => void
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

export default function UserCreateModal({
  open,
  isSaving = false,
  error = null,
  assignableRoles,
  companies,
  companiesLoading,
  companiesError,
  actorRole,
  onClose,
  onCreate,
  onErrorDismiss,
  onRetryCompanies,
}: UserCreateModalProps) {
  const [form, setForm] = useState<CreateFormState>(() =>
    buildEmptyForm(assignableRoles[0] ?? "USER"),
  )
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  useEffect(() => {
    if (!open) return

    setForm(buildEmptyForm(assignableRoles[0] ?? "USER"))
    setFieldErrors({})
    setSubmitAttempted(false)
  }, [assignableRoles, open])

  const requiresCompany =
    actorRole !== "COMPANY_MANAGER" && form.role !== "ADMIN"
  const companySelectionUnavailable =
    requiresCompany && (companiesLoading || companiesError !== "")
  const passwordError = getPasswordValidationMessage(form.password)
  const passwordIncomplete =
    passwordError !== null || form.password !== form.passwordConfirm

  const updateField = <K extends keyof CreateFormState,>(
    key: K,
    value: CreateFormState[K],
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)

    const nextFieldErrors = validateProfileFields(form, {
      requiresUsername: true,
      requiresCompany,
    })
    setFieldErrors(nextFieldErrors)

    if (
      Object.keys(nextFieldErrors).length > 0 ||
      passwordIncomplete ||
      companySelectionUnavailable
    ) {
      return
    }

    void onCreate({
      username: form.username.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      companyId: requiresCompany ? form.companyId : null,
    })
  }

  const fieldMessage = (field: keyof ProfileFieldErrors) => fieldErrors[field]

  return (
    <Dialog
      open={open}
      className={styles.modal}
      labelledBy="create-user-title"
      describedBy="create-user-description"
      isBusy={isSaving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.head}>
          <div>
            <h2 id="create-user-title">Yeni Kullanıcı</h2>
            <p id="create-user-description">
              Yeni bir kullanıcı hesabı oluşturun.
            </p>
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
            <label className={styles.label} htmlFor="create-username">
              Kullanıcı adı <span className={styles.req}>*</span>
            </label>
            <input
              id="create-username"
              className={styles.input}
              value={form.username}
              maxLength={USERNAME_MAX_LENGTH}
              onChange={(event) => updateField("username", event.target.value)}
              disabled={isSaving}
              autoComplete="off"
              aria-invalid={Boolean(fieldMessage("username"))}
            />
            {fieldMessage("username") && (
              <p className={styles.fieldError}>{fieldMessage("username")}</p>
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
                handleRoleChange(event.target.value as UserRole)
              }
              disabled={isSaving}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <UserProfileFields
          idPrefix="create"
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
            <h3 className={styles.securityTitle}>Parola</h3>
          </div>
          <div className={styles.securityBody}>
            <PasswordPairFields
              idPrefix="create"
              password={form.password}
              passwordConfirm={form.passwordConfirm}
              submitted={submitAttempted}
              disabled={isSaving}
              onChange={updateField}
            />
          </div>
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
            disabled={isSaving || companySelectionUnavailable}
          >
            {isSaving ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
