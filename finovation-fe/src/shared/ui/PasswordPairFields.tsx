import { useState } from "react"

import {
  getPasswordValidationMessage,
  PASSWORD_RULES_HELP,
} from "@/shared/lib/passwordPolicy"
import EyeIcon from "@/shared/ui/icons/EyeIcon"
import styles from "@/shared/ui/PasswordPairFields.module.css"

type PasswordPairFieldsProps = {
  idPrefix: string
  password: string
  passwordConfirm: string
  passwordLabel?: string
  submitted: boolean
  disabled: boolean
  onChange: (field: "password" | "passwordConfirm", value: string) => void
}

export default function PasswordPairFields({
  idPrefix,
  password,
  passwordConfirm,
  passwordLabel = "Parola",
  submitted,
  disabled,
  onChange,
}: PasswordPairFieldsProps) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false)
  const passwordError = getPasswordValidationMessage(password)
  const showPasswordError =
    (submitted || password.length > 0) && passwordError !== null
  const passwordMismatch =
    (submitted || passwordConfirm.length > 0) && password !== passwordConfirm

  return (
    <>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idPrefix}-password`}>
            {passwordLabel} <span className={styles.required}>*</span>
          </label>
          <div className={styles.passwordControl}>
            <input
              id={`${idPrefix}-password`}
              className={styles.input}
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => onChange("password", event.target.value)}
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={showPasswordError}
            />
            <button
              className={styles.reveal}
              type="button"
              onClick={() => setPasswordVisible((current) => !current)}
              aria-label={passwordVisible ? "Şifreyi gizle" : "Şifreyi göster"}
              aria-pressed={passwordVisible}
              disabled={disabled}
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
            htmlFor={`${idPrefix}-password-confirm`}
          >
            Parola tekrar <span className={styles.required}>*</span>
          </label>
          <div className={styles.passwordControl}>
            <input
              id={`${idPrefix}-password-confirm`}
              className={styles.input}
              type={passwordConfirmVisible ? "text" : "password"}
              value={passwordConfirm}
              onChange={(event) =>
                onChange("passwordConfirm", event.target.value)
              }
              autoComplete="new-password"
              disabled={disabled}
              aria-invalid={passwordMismatch}
            />
            <button
              className={styles.reveal}
              type="button"
              onClick={() => setPasswordConfirmVisible((current) => !current)}
              aria-label={
                passwordConfirmVisible ? "Şifreyi gizle" : "Şifreyi göster"
              }
              aria-pressed={passwordConfirmVisible}
              disabled={disabled}
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
    </>
  )
}
