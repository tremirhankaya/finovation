import { useState } from "react"
import { NavLink, Outlet, useNavigate, useLocation } from "react-router"

import styles from "@/app/layout/AppShell.module.css"
import AccountSecurityDialog from "@/features/account/components/AccountSecurityDialog"
import { useAuth } from "@/features/auth/context/AuthContext"
import Logo from "@/shared/ui/Logo"

type NavigationItem = {
  label: string
  path?: string
  icon:
      | "home"
      | "design"
      | "monitoring"
      | "optimization"
      | "stress"
      | "users"
      | "logs"
      | "plus"
      | "briefcase"
  children?: { label: string; path: string; icon: "plus" | "briefcase" }[]
}

const PRODUCT_NAVIGATION: NavigationItem[] = [
  { label: "Ana Sayfa", path: "/dashboard", icon: "home" },
  {
    label: "Fon Yönetimi",
    path: "/fund-design",
    icon: "design",
  },
  {
    label: "Fon İzleme ve Performans",
    path: "/fund-monitoring",
    icon: "monitoring",
  },
  {
    label: "Fon Optimizasyonu",
    path: "/optimization-requests/new",
    icon: "optimization",
  },
  {
    label: "Stres Testi",
    path: "/stress-test",
    icon: "stress",
  },
]

const SYSTEM_NAVIGATION: NavigationItem[] = [
  {
    label: "Kullanıcı ve Şirket Yönetimi",
    path: "/users",
    icon: "users",
  },
  { label: "Log İzleme", path: "/system-logs", icon: "logs" },
]

const ROLE_LABELS = {
  COMPANY_MANAGER: "Company Manager",
  USER: "Kullanıcı",
  ADMIN: "Admin",
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
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 12 12 17 22 12" />
        <polyline points="2 17 12 22 22 17" />
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

  if (icon === "optimization") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h10m4 0h2M4 12h4m4 0h10M4 18h13m4 0h1" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    )
  }
  if (icon === "stress") {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12h4l2-6 4 12 2-6h6" />
          <path d="M4 21h16" />
        </svg>
    )
  }

  if (icon === "plus") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    )
  }

  if (icon === "briefcase") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    )
  }

  if (icon === "logs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m7 9 3 3-3 3m5 0h5" />
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
  const location = useLocation()
  const isMatch = item.path
    ? location.pathname.startsWith(item.path)
    : item.children?.some((child) => location.pathname.startsWith(child.path))
  const [isHovered, setIsHovered] = useState(false)

  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div 
        className={styles.navGroup}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          type="button"
          className={`${styles.navigationLink} ${
            isMatch ? styles.navigationLinkActive : ""
          }`}
          aria-expanded={isHovered}
        >
          <span className={styles.navigationIcon}>
            <NavigationIcon icon={item.icon} />
          </span>
          <span>{item.label}</span>
          <svg
            className={styles.navigationLinkChevron}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        {isHovered && (
          <div className={styles.subNav}>
            {item.children!.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) =>
                  `${styles.subNavLink} ${
                    isActive ? styles.subNavLinkActive : ""
                  }`
                }
              >
                <span className={styles.navigationIcon} style={{ opacity: 0.7, transform: 'scale(0.9)' }}>
                  <NavigationIcon icon={child.icon} />
                </span>
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.path!}
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

type AppShellProps = {
  mode?: "product" | "system"
}

export default function AppShell({ mode = "product" }: AppShellProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)

  if (!user) {
    return null
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username
  const navigationItems =
    mode === "system" ? SYSTEM_NAVIGATION : PRODUCT_NAVIGATION

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

        <nav
          className={styles.navigation}
          aria-label={mode === "system" ? "Sistem menüsü" : "Ürün menüsü"}
        >
          {navigationItems.map((item) => (
            <NavigationLink key={item.label} item={item} />
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {mode === "product" && user.canAccessPanel && (
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

          <button
            type="button"
            className={styles.userSummary}
            aria-haspopup="dialog"
            aria-label={`${fullName} hesap ve güvenlik`}
            onClick={() => setIsAccountDialogOpen(true)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {fullName.charAt(0).toLocaleUpperCase("tr-TR")}
            </span>
            <span className={styles.userDetails}>
              <strong>{fullName}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </span>
          </button>
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

      <AccountSecurityDialog
        open={isAccountDialogOpen}
        user={user}
        roleLabel={ROLE_LABELS[user.role]}
        onClose={() => setIsAccountDialogOpen(false)}
        onPasswordChanged={async () => {
          setIsAccountDialogOpen(false)
          await signOut()
          navigate("/login", {
            replace: true,
            state: { passwordChanged: true },
          })
        }}
      />
    </div>
  )
}
