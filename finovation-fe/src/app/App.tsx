import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import AppShell from "@/app/layout/AppShell"
import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import FundDesignStrategyPage from "@/features/fund-design/pages/FundDesignStrategyPage"
import FundDesignAnalysisPage from "@/features/fund-design/pages/FundDesignAnalysisPage"
import FundDesignAlternativesPage from "@/features/fund-design/pages/FundDesignAlternativesPage"
import FundMonitoringPage from "@/features/fund-monitoring/pages/FundMonitoringPage"
import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"
import OptimizationResultPage from "@/features/optimization/pages/OptimizationResultPage"
import OptimizationRunningPage from "@/features/optimization/pages/OptimizationRunningPage"
import UsersPage from "@/features/users/pages/UsersPage"
import StressTestPage from "@/features/stress-test/pages/StressTestPage"

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
            element={
              <ProtectedRoute requireProductAccess>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/fund-design" element={<StartFundDraftPage />} />
            <Route
              path="/fund-design/:draftId/strategy"
              element={<FundDesignStrategyPage />}
            />
            <Route
              path="/fund-design/:draftId/analysis"
              element={<FundDesignAnalysisPage />}
            />
            <Route
              path="/fund-design/:draftId/alternatives"
              element={<FundDesignAlternativesPage />}
            />
            <Route path="/fund-monitoring" element={<FundMonitoringPage />} />
              <Route path="/stress-test" element={<StressTestPage />} />
            <Route
              path="/optimization-requests/new"
              element={<OptimizationFormPage />}
            />
            <Route
              path="/optimization-requests/:requestId/running"
              element={<OptimizationRunningPage />}
            />
            <Route
              path="/optimization-requests/:requestId/result"
              element={<OptimizationResultPage />}
            />
          </Route>

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
