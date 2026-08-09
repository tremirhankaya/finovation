import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"

import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import Logo from "@/shared/ui/Logo"
import PasswordField from "@/shared/ui/PasswordField"
import TextField from "@/shared/ui/TextField"
import BrandPanel from "@/features/auth/components/BrandPanel"
import {
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from "@/features/auth/api/authService"
import { ApiRequestError } from "@/shared/api/apiError"
import {
  getPasswordValidationMessage,
  PASSWORD_RULES_HELP,
} from "@/shared/lib/passwordPolicy"

import styles from "@/features/auth/styles/ForgotPasswordPage.module.css"

type Step = "email" | "otp" | "password" | "success"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MISMATCH_MESSAGE = "Girdiğiniz şifreler birbiriyle eşleşmiyor."

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [formError, setFormError] = useState("")
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const clearFeedback = () => {
    setFieldError("")
    setFormError("")
    setNotice("")
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setFieldError("E-posta adresi zorunludur.")
      return
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setFieldError("Geçerli bir e-posta adresi girin.")
      return
    }

    setIsSubmitting(true)
    try {
      await requestPasswordReset(normalizedEmail)
      setEmail(normalizedEmail)
      setNotice(
        "Bu adres sistemde kayıtlıysa altı haneli doğrulama kodu gönderildi.",
      )
      setStep("otp")
    } catch (error) {
      setFormError(errorMessage(error, "Doğrulama kodu gönderilemedi."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    if (!/^\d{6}$/.test(code)) {
      setFieldError("Doğrulama kodu 6 rakamdan oluşmalıdır.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await verifyPasswordResetCode(email, code)
      setResetToken(response.resetToken)
      setCode("")
      setStep("password")
    } catch (error) {
      setFormError(errorMessage(error, "Doğrulama kodu kontrol edilemedi."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    clearFeedback()
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      setCode("")
      setNotice("Bu adres sistemde kayıtlıysa yeni doğrulama kodu gönderildi.")
    } catch (error) {
      setFormError(errorMessage(error, "Yeni doğrulama kodu gönderilemedi."))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    const passwordError = getPasswordValidationMessage(newPassword)
    if (passwordError) {
      setFieldError(passwordError)
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setFieldError(PASSWORD_MISMATCH_MESSAGE)
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword(resetToken, newPassword, newPasswordConfirm)
      setResetToken("")
      setNewPassword("")
      setNewPasswordConfirm("")
      setStep("success")
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "AUTH_011") {
        setResetToken("")
        setNewPassword("")
        setNewPasswordConfirm("")
        setStep("email")
      }
      setFormError(errorMessage(error, "Şifre güncellenemedi."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepNumber = step === "email" ? 1 : step === "otp" ? 2 : 3

  return (
    <div className={styles.page}>
      <BrandPanel />

      <main className={styles.content}>
        <div className={styles.mobileLogo}>
          <Logo variant="dark" size="small" />
        </div>

        <section className={styles.card} aria-labelledby="reset-title">
          {step !== "success" && (
            <div
              className={styles.progress}
              aria-label={`Adım ${stepNumber} / 3`}
            >
              {[1, 2, 3].map((item) => (
                <span
                  key={item}
                  className={item <= stepNumber ? styles.progressActive : ""}
                />
              ))}
            </div>
          )}

          {step === "email" && (
            <>
              <header className={styles.header}>
                <p className={styles.eyebrow}>Şifre yenileme</p>
                <h1 id="reset-title">E-posta adresinizi girin</h1>
                <p>
                  Hesabınızı doğrulamak için size tek kullanımlık bir kod
                  göndereceğiz.
                </p>
              </header>

              <form
                className={styles.form}
                onSubmit={handleEmailSubmit}
                noValidate
              >
                {formError && <FormAlert>{formError}</FormAlert>}
                <TextField
                  id="reset-email"
                  label="E-posta adresi"
                  type="email"
                  value={email}
                  onChange={(value) => {
                    setEmail(value)
                    setFieldError("")
                  }}
                  error={fieldError}
                  autoComplete="email"
                  placeholder="ornek@infina.com"
                />
                <Button
                  type="submit"
                  fullWidth
                  isLoading={isSubmitting}
                  loadingText="Kod gönderiliyor…"
                >
                  Doğrulama kodu gönder
                </Button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <header className={styles.header}>
                <p className={styles.eyebrow}>E-posta doğrulama</p>
                <h1 id="reset-title">Kodu girin</h1>
                <p>
                  <strong>{email}</strong> adresi sistemde kayıtlıysa gönderilen
                  6 haneli kodu girin.
                </p>
              </header>

              <form
                className={styles.form}
                onSubmit={handleOtpSubmit}
                noValidate
              >
                {notice && <div className={styles.notice}>{notice}</div>}
                {formError && <FormAlert>{formError}</FormAlert>}
                <TextField
                  id="reset-code"
                  label="Doğrulama kodu"
                  value={code}
                  onChange={(value) => {
                    setCode(value.replace(/\D/g, "").slice(0, 6))
                    setFieldError("")
                  }}
                  error={fieldError}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={styles.codeInput}
                  placeholder="000000"
                />
                <Button
                  type="submit"
                  fullWidth
                  isLoading={isSubmitting}
                  loadingText="Kod doğrulanıyor…"
                >
                  Kodu doğrula
                </Button>
                <div className={styles.secondaryActions}>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResend}
                    disabled={isSubmitting}
                  >
                    Kodu yeniden gönder
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      clearFeedback()
                      setCode("")
                      setStep("email")
                    }}
                  >
                    E-postayı değiştir
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === "password" && (
            <>
              <header className={styles.header}>
                <p className={styles.eyebrow}>Son adım</p>
                <h1 id="reset-title">Yeni şifre oluşturun</h1>
                <p>
                  Hesabınız için güçlü ve daha önce kullanmadığınız bir şifre
                  belirleyin.
                </p>
              </header>

              <form
                className={styles.form}
                onSubmit={handlePasswordSubmit}
                noValidate
              >
                {formError && <FormAlert>{formError}</FormAlert>}
                <PasswordField
                  id="new-password"
                  label="Yeni şifre"
                  value={newPassword}
                  onChange={(value) => {
                    setNewPassword(value)
                    setFieldError("")
                  }}
                  error={
                    fieldError && fieldError !== PASSWORD_MISMATCH_MESSAGE
                      ? fieldError
                      : undefined
                  }
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <PasswordField
                  id="new-password-confirm"
                  label="Yeni şifre tekrar"
                  value={newPasswordConfirm}
                  onChange={(value) => {
                    setNewPasswordConfirm(value)
                    setFieldError("")
                  }}
                  error={
                    fieldError === PASSWORD_MISMATCH_MESSAGE
                      ? fieldError
                      : undefined
                  }
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <p className={styles.help}>{PASSWORD_RULES_HELP}</p>
                <Button
                  type="submit"
                  fullWidth
                  isLoading={isSubmitting}
                  loadingText="Şifre güncelleniyor…"
                >
                  Şifremi güncelle
                </Button>
              </form>
            </>
          )}

          {step === "success" && (
            <div className={styles.success}>
              <div className={styles.successIcon} aria-hidden="true">
                ✓
              </div>
              <header className={styles.header}>
                <h1 id="reset-title">Şifreniz başarıyla değiştirildi</h1>
                <p>Yeni şifrenizle hesabınıza giriş yapabilirsiniz.</p>
              </header>
              <Button
                fullWidth
                onClick={() => navigate("/login", { replace: true })}
              >
                Tamam
              </Button>
            </div>
          )}

          {step !== "success" && (
            <Button
              className={styles.back}
              variant="link"
              onClick={() => navigate("/login")}
            >
              ← Giriş ekranına dön
            </Button>
          )}
        </section>
      </main>
    </div>
  )
}
