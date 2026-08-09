import { Outlet } from "react-router"

import AppShell from "@/app/layout/AppShell"
import { useAuth } from "@/features/auth/context/AuthContext"

export default function SystemPanelLayout() {
  const { user } = useAuth()

  if (user?.role === "ADMIN") {
    return <AppShell mode="system" />
  }

  return <Outlet />
}
