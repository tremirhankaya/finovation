const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = configuredApiUrl?.replace(/\/$/, "") || "/api"

export const API_PATHS = {
  login: import.meta.env.VITE_LOGIN_PATH?.trim() || "/v1/auth/login",
  refresh: import.meta.env.VITE_REFRESH_PATH?.trim() || "/v1/auth/refresh",
  logout: import.meta.env.VITE_LOGOUT_PATH?.trim() || "/v1/auth/logout",
  me: import.meta.env.VITE_ME_PATH?.trim() || "/v1/auth/me",
  passwordChange:
      import.meta.env.VITE_PASSWORD_CHANGE_PATH?.trim() || "/v1/auth/password",
  users: import.meta.env.VITE_USERS_PATH?.trim() || "/v1/users",
  companies: import.meta.env.VITE_COMPANIES_PATH?.trim() || "/v1/companies",
  passwordResetRequest:
      import.meta.env.VITE_PASSWORD_RESET_REQUEST_PATH?.trim() ||
      "/v1/auth/password-reset/request",
  passwordResetVerify:
      import.meta.env.VITE_PASSWORD_RESET_VERIFY_PATH?.trim() ||
      "/v1/auth/password-reset/verify",
  passwordReset:
      import.meta.env.VITE_PASSWORD_RESET_PATH?.trim() ||
      "/v1/auth/password-reset/reset",
  fundDrafts:
      import.meta.env.VITE_FUND_DRAFTS_PATH?.trim() || "/v1/fund-drafts",
  funds: import.meta.env.VITE_FUNDS_PATH?.trim() || "/v1/funds",
  optimizationRequests:
      import.meta.env.VITE_OPTIMIZATION_REQUESTS_PATH?.trim() ||
      "/v1/optimization-requests",
  investmentUniverse:
      import.meta.env.VITE_INVESTMENT_UNIVERSE_PATH?.trim() ||
      "/v1/investment-universe",
} as const

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`
}

function buildUrl(path: string): string {
  return `${API_BASE_URL}${normalizePath(path)}`
}

export function getLoginUrl(): string {
  return buildUrl(API_PATHS.login)
}

export function getMeUrl(): string {
  return buildUrl(API_PATHS.me)
}

export function getPasswordChangeUrl(): string {
  return buildUrl(API_PATHS.passwordChange)
}

export function getRefreshUrl(): string {
  return buildUrl(API_PATHS.refresh)
}

export function getLogoutUrl(): string {
  return buildUrl(API_PATHS.logout)
}

export function getUsersUrl(userId?: number): string {
  const base = buildUrl(API_PATHS.users)
  return userId == null ? base : `${base}/${userId}`
}

export function getCompaniesUrl(companyId?: number): string {
  const base = buildUrl(API_PATHS.companies)
  return companyId == null ? base : `${base}/${companyId}`
}

export function getPasswordResetRequestUrl(): string {
  return buildUrl(API_PATHS.passwordResetRequest)
}

export function getPasswordResetVerifyUrl(): string {
  return buildUrl(API_PATHS.passwordResetVerify)
}

export function getPasswordResetUrl(): string {
  return buildUrl(API_PATHS.passwordReset)
}

export function getFundDraftsUrl(): string {
  return buildUrl(API_PATHS.fundDrafts)
}

export function getFundDraftInitUrl(
    page: string,
    draftId?: string,
): string {
  const params = new URLSearchParams({ page })
  if (draftId) {
    params.set("draftId", draftId)
  }
  return `${getFundDraftsUrl()}/init?${params.toString()}`
}

export function getFundDraftUrl(draftId: string): string {
  return `${getFundDraftsUrl()}/${encodeURIComponent(draftId)}`
}

export function getFundDraftCompletionUrl(draftId: string): string {
  return buildUrl(`${API_PATHS.fundDrafts}/${draftId}/completion`)
}

export function getFundEstimatesUrl(draftId: string): string {
  return buildUrl(`${API_PATHS.fundDrafts}/${draftId}/estimates`)
}

export function getFundDraftPortfolioRulesUrl(draftId: string): string {
  return `${getFundDraftsUrl()}/${encodeURIComponent(draftId)}/portfolio-rules`
}

export function getFundDraftAnalysisUrl(draftId: string): string {
  return `${getFundDraftsUrl()}/${encodeURIComponent(draftId)}/analysis`
}

export function getFundDraftSelectedProposalUrl(draftId: string): string {
  return `${getFundDraftsUrl()}/${encodeURIComponent(draftId)}/selected-proposal`
}

export function getFundDraftWorkingPortfolioUrl(draftId: string): string {
  return `${getFundDraftsUrl()}/${encodeURIComponent(draftId)}/working-portfolio`
}

export function getFundDraftModelUniverseUrl(): string {
  return `${getFundDraftsUrl()}/model-universe`
}

export function getFundsUrl(): string {
  return buildUrl(API_PATHS.funds)
}

export function getFundMonitoringUrl(fundId: string): string {
  return `${getFundsUrl()}/${encodeURIComponent(fundId)}/monitoring`
}

export function getOptimizationRequestsUrl(fundId?: string): string {
  const base = buildUrl(API_PATHS.optimizationRequests)
  return fundId == null ? base : `${base}?fundId=${encodeURIComponent(fundId)}`
}

export function getOptimizationRequestUrl(requestId: number): string {
  return `${buildUrl(API_PATHS.optimizationRequests)}/${requestId}`
}

export function getOptimizationRequestRunUrl(requestId: number): string {
  return `${getOptimizationRequestUrl(requestId)}/run`
}

export function getOptimizationRequestApproveUrl(requestId: number): string {
  return `${getOptimizationRequestUrl(requestId)}/approve`
}

export function getOptimizationRequestRejectUrl(requestId: number): string {
  return `${getOptimizationRequestUrl(requestId)}/reject`
}

export function getInvestmentUniverseUrl(): string {
  return buildUrl(API_PATHS.investmentUniverse)
}