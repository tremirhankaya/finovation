import { useNavigate } from "react-router-dom"

export default function DashboardPage() {
    const navigate = useNavigate()

    return (
        <div>
            <h1>Geçici Dashboard</h1>

            <button onClick={() => navigate("/login")}>
                Giriş ekranına dön
            </button>

        </div>
    )
}