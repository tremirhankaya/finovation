import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router"

import LoginPage from "@/pages/login/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import UsersPage from "@/pages/users/UsersPage"

export default function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<LoginPage />} />

          <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
          />

          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/users" element={<UsersPage />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
  )
}