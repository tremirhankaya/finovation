import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import FundDesignStrategyPage from "@/features/fund-design/pages/FundDesignStrategyPage"
import FundMonitoringPage from "@/features/fund-monitoring/pages/FundMonitoringPage"
import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"
import OptimizationRunningPage from "@/features/optimization/pages/OptimizationRunningPage"
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
            path="/fund-design"
            element={
              <ProtectedRoute>
                <StartFundDraftPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/fund-design/:draftId/strategy"
            element={
              <ProtectedRoute>
                <FundDesignStrategyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/fund-monitoring"
            element={
              <ProtectedRoute>
                <FundMonitoringPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/optimization-requests/new"
            element={
              <ProtectedRoute>
                <OptimizationFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/optimization-requests/:requestId/running"
            element={
              <ProtectedRoute>
                <OptimizationRunningPage />
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
