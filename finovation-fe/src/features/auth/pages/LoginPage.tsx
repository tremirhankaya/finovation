import { type FormEvent, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import Button from "@/shared/ui/Button"
import FormAlert from "@/shared/ui/FormAlert"
import Logo from "@/shared/ui/Logo"
import PasswordField from "@/shared/ui/PasswordField"
import TextField from "@/shared/ui/TextField"
import {
  type LoginFieldErrors,
  validateLoginCredentials,
} from "@/features/auth/model/loginSchema"
import { useAuth } from "@/features/auth/context/AuthContext"
import { getAuthenticatedHomePath } from "@/app/router/routeAccess"

import BrandPanel from "@/features/auth/components/BrandPanel"
import styles from "@/features/auth/styles/LoginPage.module.css"

const UNKNOWN_LOGIN_ERROR = "Giriş sırasında beklenmeyen bir hata oluştu."
const SESSION_EXPIRED_MESSAGE =
  "Oturumunuz sona erdi. Lütfen tekrar giriş yapın."
const PASSWORD_CHANGED_MESSAGE =
  "Parolanız değiştirildi. Yeni parolanızla giriş yapabilirsiniz."

type LoginLocationState = {
  sessionExpired?: boolean
  passwordChanged?: boolean
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [formError, setFormError] = useState(() =>
    (location.state as LoginLocationState | null)?.sessionExpired
      ? SESSION_EXPIRED_MESSAGE
      : "",
  )
  const [successMessage, setSuccessMessage] = useState(() =>
    (location.state as LoginLocationState | null)?.passwordChanged
      ? PASSWORD_CHANGED_MESSAGE
      : "",
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateLoginCredentials({
      username,
      password,
    })

    setFieldErrors(validation.errors)
    setFormError("")
    setSuccessMessage("")

    if (!validation.success) return

    setIsSubmitting(true)

    try {
      const currentUser = await signIn(validation.data)
      if (currentUser) {
        navigate(getAuthenticatedHomePath(currentUser), { replace: true })
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : UNKNOWN_LOGIN_ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleForgotPassword() {
    navigate("/forgot-password")
  }

  return (
    <div className={styles.page}>
      <BrandPanel />

      <main className={styles.content}>
        <div className={styles.mobileLogo}>
          <Logo variant="dark" size="small" />
        </div>

        <section className={styles.card} aria-labelledby="login-title">
          <header className={styles.header}>
            <h1 id="login-title">Hoş geldiniz</h1>
            <p>Fon karar destek platformuna devam etmek için giriş yapın.</p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {successMessage && (
              <p className={styles.successMessage} role="status">
                {successMessage}
              </p>
            )}
            {formError && <FormAlert>{formError}</FormAlert>}

            <TextField
              id="username"
              label="Kullanıcı Adı"
              value={username}
              onChange={setUsername}
              error={fieldErrors.username}
              autoComplete="username"
            />

            <PasswordField
              id="password"
              label="Şifre"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <div className={styles.forgotPassword}>
              <Button
                type="button"
                variant="link"
                onClick={handleForgotPassword}
              >
                Şifremi unuttum
              </Button>
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              loadingText="Giriş yapılıyor…"
              fullWidth
            >
              Giriş yap
            </Button>
          </form>
        </section>
      </main>
    </div>
  )
}
