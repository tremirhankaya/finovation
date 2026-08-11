import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import AppShell from "@/app/layout/AppShell"
import SystemPanelLayout from "@/app/layout/SystemPanelLayout"
import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import LoginPage from "@/features/auth/pages/LoginPage"
import DashboardPage from "@/features/dashboard/pages/DashboardPage"
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage"
import FundManagementPage from "@/features/fund-design/pages/FundManagementPage"
import StartFundDraftPage from "@/features/fund-design/pages/StartFundDraftPage"
import FundDesignStrategyPage from "@/features/fund-design/pages/FundDesignStrategyPage"
import FundDesignAnalysisPage from "@/features/fund-design/pages/FundDesignAnalysisPage"
import FundDesignAlternativesPage from "@/features/fund-design/pages/FundDesignAlternativesPage"
import FundDesignApprovalPage from "@/features/fund-design/pages/FundDesignApprovalPage"
import FundDesignEditPage from "@/features/fund-design/pages/FundDesignEditPage"
import FundDesignSuccessPage from "@/features/fund-design/pages/FundDesignSuccessPage"
import FundMonitoringPage from "@/features/fund-monitoring/pages/FundMonitoringPage"
import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"
import OptimizationLogsPage from "@/features/optimization/pages/OptimizationLogsPage"
import OptimizationResultPage from "@/features/optimization/pages/OptimizationResultPage"
import OptimizationRunningPage from "@/features/optimization/pages/OptimizationRunningPage"
import UsersPage from "@/features/users/pages/UsersPage"
import StressTestPage from "@/features/stress-test/pages/StressTestPage"
import PasswordChangeRequiredPage from "@/features/account/pages/PasswordChangeRequiredPage"
import SystemLogsPage from "@/features/system-logs/pages/SystemLogsPage"
import RlStressTestPage from "@/features/stress-test/pages/RlStressTestPage"

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
                        <Route path="/fund-design" element={<FundManagementPage />} />
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

                        <Route path="/stress-test" element={<StressTestPage />} />

                        <Route
                            path="/stress-test/rl"
                            element={<RlStressTestPage />}
                        />

                        <Route
                            path="/optimization-requests/new"
                            element={<OptimizationFormPage />}
                        />
                        <Route
                            path="/optimization-requests/logs"
                            element={<OptimizationLogsPage />}
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
                        element={
                            <ProtectedRoute requirePanelAccess>
                                <SystemPanelLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/users" element={<UsersPage />} />
                        <Route
                            path="/system-logs"
                            element={
                                <ProtectedRoute requireAdmin>
                                    <SystemLogsPage />
                                </ProtectedRoute>
                            }
                        />
                    </Route>

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
