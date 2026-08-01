import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"

import Button from "@/component/Button"
import FormAlert from "@/component/FormAlert"
import Logo from "@/component/Logo"
import PasswordField from "@/component/PasswordField"
import TextField from "@/component/TextField"
import {
  type LoginFieldErrors,
  validateLoginCredentials,
} from "@/schema/authSchema"
import { useAuth } from "@/context/AuthContext"
import { login } from "@/service/authService"
import { saveAccessToken } from "@/util/authStorage"

import BrandPanel from "./component/BrandPanel"
import styles from "./css/LoginPage.module.css"

const UNKNOWN_LOGIN_ERROR = "Giriş sırasında beklenmeyen bir hata oluştu."

export default function LoginPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [formError, setFormError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateLoginCredentials({
      username,
      password,
    })

    setFieldErrors(validation.errors)
    setFormError("")

    if (!validation.success) return

    setIsSubmitting(true)

    try {
      const result = await login(validation.data)

      if (!result.accessToken) {
        setFormError(UNKNOWN_LOGIN_ERROR)
        return
      }

      saveAccessToken(result.accessToken)
      await refreshUser()
      navigate("/dashboard", { replace: true })
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

