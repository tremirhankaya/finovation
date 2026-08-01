import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router"

import ProtectedRoute from "@/component/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import LoginPage from "@/pages/login/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import UsersPage from "@/pages/users/UsersPage"

export default function App() {
  return (
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<LoginPage />} />

            <Route
                path="/forgot-password"
                element={<ForgotPasswordPage />}
            />

            <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
            />

            <Route
                path="/users"
                element={
                  <ProtectedRoute requirePanelAccess>
                    <UsersPage />
                  </ProtectedRoute>
                }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
  )
}