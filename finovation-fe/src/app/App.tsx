import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import AppShell from "@/app/layout/AppShell"
import SystemPanelLayout from "@/app/layout/SystemPanelLayout"
import ProtectedRoute from "@/app/router/ProtectedRoute"
import GuestRoute from "@/app/router/GuestRoute"
import AuthProvider from "@/features/auth/context/AuthProvider"
import { FundLoader } from "@/shared/ui/FundLoader"

const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"))
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"))
const ForgotPasswordPage = lazy(() => import("@/features/auth/pages/ForgotPasswordPage"))
const FundManagementPage = lazy(() => import("@/features/fund-design/pages/FundManagementPage"))
const StartFundDraftPage = lazy(() => import("@/features/fund-design/pages/StartFundDraftPage"))
const FundDesignStrategyPage = lazy(() => import("@/features/fund-design/pages/FundDesignStrategyPage"))
const FundDesignAnalysisPage = lazy(() => import("@/features/fund-design/pages/FundDesignAnalysisPage"))
const FundDesignAlternativesPage = lazy(() => import("@/features/fund-design/pages/FundDesignAlternativesPage"))
const FundDesignApprovalPage = lazy(() => import("@/features/fund-design/pages/FundDesignApprovalPage"))
const FundDesignEditPage = lazy(() => import("@/features/fund-design/pages/FundDesignEditPage"))
const FundDesignSuccessPage = lazy(() => import("@/features/fund-design/pages/FundDesignSuccessPage"))
const FundMonitoringPage = lazy(() => import("@/features/fund-monitoring/pages/FundMonitoringPage"))
const OptimizationFormPage = lazy(() => import("@/features/optimization/pages/OptimizationFormPage"))
const OptimizationLogsPage = lazy(() => import("@/features/optimization/pages/OptimizationLogsPage"))
const OptimizationResultPage = lazy(() => import("@/features/optimization/pages/OptimizationResultPage"))
const OptimizationRunningPage = lazy(() => import("@/features/optimization/pages/OptimizationRunningPage"))
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage"))
const StressTestPage = lazy(() => import("@/features/stress-test/pages/StressTestPage"))
const PasswordChangeRequiredPage = lazy(() => import("@/features/account/pages/PasswordChangeRequiredPage"))
const SystemLogsPage = lazy(() => import("@/features/system-logs/pages/SystemLogsPage"))
const RlStressTestPage = lazy(() => import("@/features/stress-test/pages/RlStressTestPage"))

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Suspense fallback={<FundLoader message="Sayfa yükleniyor…" />}>
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
                </Suspense>
            </AuthProvider>
        </BrowserRouter>
    )
}
