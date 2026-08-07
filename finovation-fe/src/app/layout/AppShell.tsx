import { useState } from "react"
import { NavLink, Outlet } from "react-router"

import styles from "@/app/layout/AppShell.module.css"
import { useAuth } from "@/features/auth/context/AuthContext"
import Logo from "@/shared/ui/Logo"

type NavigationItem = {
  label: string
  path: string
  icon: "home" | "design" | "monitoring" | "users"
}

const PRODUCT_NAVIGATION: NavigationItem[] = [
  { label: "Ana Sayfa", path: "/dashboard", icon: "home" },
  { label: "Fon Tasarımı", path: "/fund-design", icon: "design" },
  {
    label: "Fon İzleme ve Performans",
    path: "/fund-monitoring",
    icon: "monitoring",
  },
]

const ROLE_LABELS = {
  ADMIN: "Admin",
  USER: "Kullanıcı",
  SUPER_ADMIN: "Super Admin",
} as const

function NavigationIcon({ icon }: { icon: NavigationItem["icon"] }) {
  if (icon === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    )
  }

  if (icon === "design") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M3 12h18" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }

  if (icon === "monitoring") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-2-11.96a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function NavigationLink({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `${styles.navigationLink} ${
          isActive ? styles.navigationLinkActive : ""
        }`
      }
    >
      <span className={styles.navigationIcon}>
        <NavigationIcon icon={item.icon} />
      </span>
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!user) {
    return null
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username

  return (
    <div
      className={`${styles.appShell} ${
        isCollapsed ? styles.appShellCollapsed : ""
      }`}
    >
      <aside
        id="product-navigation"
        className={styles.sidebar}
        aria-label="Ana menü"
        aria-hidden={isCollapsed}
        inert={isCollapsed}
      >
        <div className={styles.brand}>
          <Logo variant="dark" size="small" subtitle="Karar Destek Platformu" />
        </div>

        <nav className={styles.navigation} aria-label="Ürün menüsü">
          {PRODUCT_NAVIGATION.map((item) => (
            <NavigationLink key={item.path} item={item} />
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {user.canAccessPanel && (
            <NavigationLink
              item={{
                label: "Kullanıcı Yönetimi",
                path: "/users",
                icon: "users",
              }}
            />
          )}

          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => void signOut()}
          >
            <span className={styles.navigationIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 17l5-5-5-5m5 5H3m12-9h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5" />
              </svg>
            </span>
            <span>Çıkış Yap</span>
          </button>

          <div className={styles.userSummary}>
            <span className={styles.avatar} aria-hidden="true">
              {fullName.charAt(0).toLocaleUpperCase("tr-TR")}
            </span>
            <span className={styles.userDetails}>
              <strong>{fullName}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </span>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={styles.sidebarToggle}
        aria-controls="product-navigation"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Menüyü göster" : "Menüyü gizle"}
        onClick={() => setIsCollapsed((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={isCollapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
        </svg>
      </button>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
