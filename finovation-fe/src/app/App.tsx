import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import AppShell from "@/app/layout/AppShell"
import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import FundDraftsPage from "@/features/fund-design/pages/FundDraftsPage"
import FundActivePage from "@/features/fund-design/pages/FundActivePage"
import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import FundDesignStrategyPage from "@/features/fund-design/pages/FundDesignStrategyPage"
import FundDesignAnalysisPage from "@/features/fund-design/pages/FundDesignAnalysisPage"
import FundDesignAlternativesPage from "@/features/fund-design/pages/FundDesignAlternativesPage"
import FundDesignApprovalPage from "@/features/fund-design/pages/FundDesignApprovalPage"
import FundDesignEditPage from "@/features/fund-design/pages/FundDesignEditPage"
import FundDesignSuccessPage from "@/features/fund-design/pages/FundDesignSuccessPage"
import FundMonitoringPage from "@/features/fund-monitoring/pages/FundMonitoringPage"
import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"
import OptimizationResultPage from "@/features/optimization/pages/OptimizationResultPage"
import OptimizationRunningPage from "@/features/optimization/pages/OptimizationRunningPage"
import UsersPage from "@/features/users/pages/UsersPage"
import PasswordChangeRequiredPage from "@/features/account/pages/PasswordChangeRequiredPage"

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
                        path="/account/password-required"
                        element={
                            <ProtectedRoute allowPasswordChangeRequired>
                                <PasswordChangeRequiredPage />
                            </ProtectedRoute>
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
                        <Route path="/fund-design" element={<Navigate to="/fund-design/create" replace />} />
                        <Route path="/fund-design/create" element={<FundDraftsPage />} />
                        <Route path="/fund-design/active" element={<FundActivePage />} />
                        <Route path="/fund-design/new" element={<StartFundDraftPage />} />
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
                        <Route
                            path="/fund-design/:draftId/edit"
                            element={<FundDesignEditPage />}
                        />
                        <Route
                            path="/fund-design/:draftId/approve"
                            element={<FundDesignApprovalPage />}
                        />
                        <Route
                            path="/fund-design/:draftId/completed"
                            element={<FundDesignSuccessPage />}
                        />
                        <Route path="/fund-monitoring" element={<FundMonitoringPage />} />
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