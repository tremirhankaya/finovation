import { useState } from "react"
import { useNavigate } from "react-router"

import appShellStyles from "@/app/layout/AppShell.module.css"
import AccountSecurityDialog from "@/features/account/components/AccountSecurityDialog"
import { useAuth } from "@/features/auth/context/AuthContext"
import Dialog from "@/shared/ui/Dialog"
import Logo from "@/shared/ui/Logo"
import styles from "@/features/account/styles/PasswordChangeRequiredPage.module.css"

const ROLE_LABELS = {
  COMPANY_MANAGER: "Company Manager",
  USER: "Kullanıcı",
  ADMIN: "Admin",
} as const

const LOCKED_MODULES = [
  "Ana Sayfa",
  "Fon Tasarımı",
  "Fon İzleme ve Performans",
  "Fon Optimizasyonu",
]

export default function PasswordChangeRequiredPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isNoticeOpen, setIsNoticeOpen] = useState(true)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)

  if (!user) return null

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username

  const openPasswordDialog = () => {
    setIsNoticeOpen(false)
    setIsAccountDialogOpen(true)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login", { replace: true })
  }

  const handlePasswordChanged = async () => {
    setIsAccountDialogOpen(false)
    await signOut()
    navigate("/login", {
      replace: true,
      state: { passwordChanged: true },
    })
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar} aria-label="Kısıtlı hesap menüsü">
        <div className={appShellStyles.brand}>
          <Logo variant="dark" size="small" subtitle="Karar Destek Platformu" />
        </div>

        <div className={styles.lockedNavigation} aria-label="Kilitli modüller">
          <p>Modüller</p>
          {LOCKED_MODULES.map((module) => (
            <div className={styles.lockedNavigationItem} key={module}>
              <span className={styles.lockIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <span>{module}</span>
            </div>
          ))}
        </div>

        <div
          className={`${appShellStyles.sidebarFooter} ${styles.sidebarFooter}`}
        >
          <button
            type="button"
            className={appShellStyles.signOutButton}
            onClick={() => void handleSignOut()}
          >
            <span className={appShellStyles.navigationIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 17l5-5-5-5m5 5H3m12-9h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5" />
              </svg>
            </span>
            <span>Çıkış Yap</span>
          </button>
          <button
            type="button"
            className={appShellStyles.userSummary}
            aria-haspopup="dialog"
            aria-label={`${fullName} hesap ve güvenlik`}
            onClick={openPasswordDialog}
          >
            <span className={appShellStyles.avatar} aria-hidden="true">
              {fullName.charAt(0).toLocaleUpperCase("tr-TR")}
            </span>
            <span className={appShellStyles.userDetails}>
              <strong>{fullName}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </span>
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <section
          className={styles.securityCard}
          aria-labelledby="security-title"
        >
          <div className={styles.shield} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3 5 6v5c0 4.8 2.8 8.3 7 10 4.2-1.7 7-5.2 7-10V6z" />
              <path d="m9 12 2 2 4-5" />
            </svg>
          </div>
          <span className={styles.eyebrow}>İlk giriş güvenlik adımı</span>
          <h1 id="security-title">Hesabınızı kullanmaya başlamadan önce</h1>
          <p className={styles.lead}>
            Hesabınız geçici bir parolayla oluşturuldu. Finovation modüllerine
            erişebilmek için yalnızca size ait yeni bir parola belirleyin.
          </p>

          <div className={styles.steps}>
            <article>
              <span>1</span>
              <div>
                <h2>Yeni parolanızı belirleyin</h2>
                <p>Güçlü ve mevcut parolanızdan farklı bir parola kullanın.</p>
              </div>
            </article>
            <article>
              <span>2</span>
              <div>
                <h2>Güvenli şekilde yeniden giriş yapın</h2>
                <p>Değişiklikten sonra mevcut oturumunuz otomatik kapatılır.</p>
              </div>
            </article>
            <article>
              <span>3</span>
              <div>
                <h2>Tüm modüllere erişin</h2>
                <p>
                  Yeni parolanızla giriş yaptığınızda menüler kullanıma açılır.
                </p>
              </div>
            </article>
          </div>

          <button
            type="button"
            className={styles.primaryAction}
            onClick={openPasswordDialog}
          >
            Parolamı şimdi değiştir
          </button>
          <p className={styles.accountHint}>
            Bu ekrana sol alttaki hesap kartından da ulaşabilirsiniz.
          </p>
        </section>
      </main>

      <Dialog
        open={isNoticeOpen}
        className={styles.noticeDialog}
        labelledBy="password-notice-title"
        describedBy="password-notice-description"
        role="alertdialog"
        onClose={() => setIsNoticeOpen(false)}
      >
        <div className={styles.noticeIcon} aria-hidden="true">
          !
        </div>
        <h2 id="password-notice-title">Parola değişikliği gerekiyor</h2>
        <p id="password-notice-description">
          Bu ilk girişiniz olduğu için hesabınızı kullanmadan önce geçici
          parolanızı değiştirmeniz gerekiyor. İşlem tamamlanana kadar ürün
          modülleri kilitli kalacaktır.
        </p>
        <div className={styles.noticeActions}>
          <button type="button" onClick={() => setIsNoticeOpen(false)}>
            Daha sonra
          </button>
          <button type="button" onClick={openPasswordDialog}>
            Parolayı değiştir
          </button>
        </div>
      </Dialog>

      <AccountSecurityDialog
        open={isAccountDialogOpen}
        user={user}
        roleLabel={ROLE_LABELS[user.role]}
        initialPasswordFormOpen
        onClose={() => setIsAccountDialogOpen(false)}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  )
}
