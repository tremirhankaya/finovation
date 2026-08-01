import { useNavigate } from "react-router"

import { useAuth } from "@/context/AuthContext"

export default function DashboardPage() {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()

    function handleReturnToLogin() {
        signOut()
        navigate("/login")
    }

    return (
        <div>
            <h1>Geçici Dashboard</h1>
            {user && <p>Hoş geldin, {user.firstName} ({user.role})</p>}

            {user?.canAccessPanel && (
                <button onClick={() => navigate("/users")}>
                    Kullanıcılar
                </button>
            )}

            <button onClick={handleReturnToLogin}>
                Giriş ekranına dön
            </button>

        </div>
    )
}