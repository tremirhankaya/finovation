import { Link } from "react-router"

import DashboardIcon, {
  type DashboardIconName,
} from "@/features/dashboard/components/DashboardIcon"
import styles from "@/features/dashboard/styles/DashboardPage.module.css"

const ACTIONS: Array<{
  label: string
  detail: string
  path: string
  icon: DashboardIconName
}> = [
  {
    label: "Yeni Fon Tasarla",
    detail: "AI destekli tasarım",
    path: "/fund-design/new",
    icon: "create",
  },
  {
    label: "Fonları İzle",
    detail: "Getiri ve performans",
    path: "/fund-monitoring",
    icon: "performance",
  },
  {
    label: "Optimizasyon Başlat",
    detail: "Portföyü iyileştir",
    path: "/optimization-requests/new",
    icon: "optimization",
  },
  {
    label: "Stres Testi Çalıştır",
    detail: "Risk senaryoları",
    path: "/stress-test",
    icon: "stress",
  },
]

export default function QuickActions() {
  return (
    <nav className={styles.quickActions} aria-label="Hızlı işlemler">
      {ACTIONS.map((action) => (
        <Link className={styles.quickAction} to={action.path} key={action.path}>
          <span className={styles.quickActionIcon}>
            <DashboardIcon name={action.icon} />
          </span>
          <span>
            <strong>{action.label}</strong>
            <small>{action.detail}</small>
          </span>
          <span className={styles.quickActionArrow}>
            <DashboardIcon name="arrow" />
          </span>
        </Link>
      ))}
    </nav>
  )
}
