import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type ProfileFieldErrors,
} from "@/features/users/lib/userFormValidation"
import styles from "@/features/users/styles/UserFormModal.module.css"

type UserProfileFieldsProps = {
  idPrefix: string
  firstName: string
  lastName: string
  email: string
  errors: Pick<ProfileFieldErrors, "firstName" | "lastName" | "email">
  disabled: boolean
  onChange: (field: "firstName" | "lastName" | "email", value: string) => void
}

export default function UserProfileFields({
  idPrefix,
  firstName,
  lastName,
  email,
  errors,
  disabled,
  onChange,
}: UserProfileFieldsProps) {
  return (
    <>
      <div className={styles.grid2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-first-name`}>
            Ad <span className={styles.req}>*</span>
          </label>
          <input
            id={`${idPrefix}-first-name`}
            className={styles.input}
            value={firstName}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => onChange("firstName", event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.firstName)}
          />
          {errors.firstName && (
            <p className={styles.fieldError}>{errors.firstName}</p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-last-name`}>
            Soyad <span className={styles.req}>*</span>
          </label>
          <input
            id={`${idPrefix}-last-name`}
            className={styles.input}
            value={lastName}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => onChange("lastName", event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.lastName)}
          />
          {errors.lastName && (
            <p className={styles.fieldError}>{errors.lastName}</p>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${idPrefix}-email`}>
          E-posta <span className={styles.req}>*</span>
        </label>
        <input
          id={`${idPrefix}-email`}
          className={styles.input}
          type="email"
          value={email}
          maxLength={EMAIL_MAX_LENGTH}
          onChange={(event) => onChange("email", event.target.value)}
          placeholder="ornek@infina.com"
          disabled={disabled}
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
      </div>
    </>
  )
}
