import { useNavigate } from "react-router"

import { useAuth } from "@/features/auth/context/AuthContext"

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  async function handleReturnToLogin() {
    await signOut()
    navigate("/login")
  }

  return (
    <div>
      <h1>Geçici Dashboard</h1>
      {user && (
        <p>
          Hoş geldin, {user.firstName} ({user.role})
        </p>
      )}

      <button onClick={() => navigate("/fund-design")}>Fon Tasarımı</button>

      {user?.canAccessPanel && (
        <button onClick={() => navigate("/users")}>Kullanıcılar</button>
      )}

      <button onClick={() => navigate("/fund-monitoring")}>
        Fon İzleme ve Performans
      </button>

      <button onClick={() => navigate("/optimization-requests/new")}>
        Fon Optimizasyonu
      </button>

      <button onClick={handleReturnToLogin}>Giriş ekranına dön</button>
    </div>
  )
}
