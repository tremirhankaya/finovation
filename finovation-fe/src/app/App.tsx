import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import UsersPage from "@/features/users/pages/UsersPage"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <GuestRoute>
                <Navigate to="/login" replace />
              </GuestRoute>
            }
          />

          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          <Route
            path="/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
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

          <Route
            path="*"
            element={
              <GuestRoute>
                <Navigate to="/login" replace />
              </GuestRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
