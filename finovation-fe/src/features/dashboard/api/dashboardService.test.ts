import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  listInProgressDrafts: vi.fn(),
  fetchFunds: vi.fn(),
  fetchFundMonitoring: vi.fn(),
  fetchOptimizationLogs: vi.fn(),
  fetchOptimizationResult: vi.fn(),
  fetchStressTestHistory: vi.fn(),
}))

vi.mock("@/features/fund-design/api/fundDraftApi", () => ({
  listInProgressDrafts: apiMocks.listInProgressDrafts,
}))

vi.mock("@/features/fund-monitoring/api/fundMonitoringService", () => ({
  fetchFunds: apiMocks.fetchFunds,
  fetchFundMonitoring: apiMocks.fetchFundMonitoring,
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  fetchOptimizationLogs: apiMocks.fetchOptimizationLogs,
  fetchOptimizationResult: apiMocks.fetchOptimizationResult,
}))

vi.mock("@/features/stress-test/api/stressTestService", () => ({
  fetchStressTestHistory: apiMocks.fetchStressTestHistory,
}))

import {
  loadDashboardOverview,
  loadFundPerformance,
} from "@/features/dashboard/api/dashboardService"

const FUNDS = [
  { id: "fund-1", name: "Büyüme Fonu", type: "Hisse Senedi Yoğun Fon" },
]

const DRAFTS = [
  {
    draftId: "11111111-1111-4111-8111-111111111111",
    name: "Eski Taslak",
    currentStep: 2,
    status: "IN_PROGRESS" as const,
    updatedAt: "2026-08-01T10:00:00",
  },
  {
    draftId: "22222222-2222-4222-8222-222222222222",
    name: "Yeni Taslak",
    currentStep: 4,
    status: "IN_PROGRESS" as const,
    updatedAt: "2026-08-09T10:00:00",
  },
]

const LOGS = [
  {
    requestId: 12,
    fundId: "11111111-1111-4111-8111-111111111111",
    fundName: "Büyüme Fonu",
    requestedByUsername: "user",
    status: "RUNNING" as const,
    createdAt: "2026-08-10T10:00:00",
    completedAt: null,
    updatedAt: "2026-08-10T10:02:00",
    resultAvailable: false,
  },
  {
    requestId: 11,
    fundId: "11111111-1111-4111-8111-111111111111",
    fundName: "Büyüme Fonu",
    requestedByUsername: "user",
    status: "COMPLETED" as const,
    createdAt: "2026-08-09T10:00:00",
    completedAt: "2026-08-09T10:05:00",
    updatedAt: "2026-08-09T10:05:00",
    resultAvailable: true,
  },
]

const STRESS_TESTS = [
  {
    testId: "33333333-3333-4333-8333-333333333333",
    scenarioCode: "GLOBAL_CRISIS",
    scenarioName: "Küresel Kriz",
    asOfDate: "2026-08-08",
    portfolioImpact: -0.08,
    createdAt: "2026-08-08T15:00:00",
  },
]

const OPTIMIZATION_RESULT = {
  generatedAt: "2026-08-09T10:05:00",
  assets: [],
  metrics: [{ key: "VOLATILITY", currentValue: 24, proposedValue: 20 }],
}

describe("dashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.fetchFunds.mockResolvedValue(FUNDS)
    apiMocks.listInProgressDrafts.mockResolvedValue(DRAFTS)
    apiMocks.fetchOptimizationLogs.mockResolvedValue(LOGS)
    apiMocks.fetchOptimizationResult.mockResolvedValue(OPTIMIZATION_RESULT)
    apiMocks.fetchStressTestHistory.mockResolvedValue(STRESS_TESTS)
  })

  it("modül özetlerini birleştirir ve son sonucu bulunan optimizasyonu yükler", async () => {
    const controller = new AbortController()
    const response = await loadDashboardOverview(controller.signal)

    expect(response.data.funds).toEqual(FUNDS)
    expect(response.data.drafts.map((draft) => draft.name)).toEqual([
      "Yeni Taslak",
      "Eski Taslak",
    ])
    expect(response.data.optimizationLogs[0].requestId).toBe(12)
    expect(response.data.latestOptimizationResult).toEqual(OPTIMIZATION_RESULT)
    expect(response.data.stressTests).toEqual(STRESS_TESTS)
    expect(apiMocks.fetchOptimizationResult).toHaveBeenCalledWith(
      11,
      controller.signal,
    )
    expect(response.errors).toEqual({
      funds: "",
      drafts: "",
      optimization: "",
      stressTests: "",
    })
  })

  it("bir modül başarısız olduğunda diğer dashboard bölümlerini korur", async () => {
    apiMocks.fetchFunds.mockRejectedValue(new Error("Fon servisi kapalı"))
    apiMocks.fetchOptimizationResult.mockRejectedValue(
      new Error("Sonuç geçici olarak alınamadı"),
    )

    const response = await loadDashboardOverview()

    expect(response.data.funds).toEqual([])
    expect(response.data.drafts).toHaveLength(2)
    expect(response.data.stressTests).toHaveLength(1)
    expect(response.data.optimizationLogs).toHaveLength(2)
    expect(response.data.latestOptimizationResult).toBeNull()
    expect(response.errors.funds).toBe("Fon servisi kapalı")
    expect(response.errors.optimization).toBe("Sonuç geçici olarak alınamadı")
  })

  it("seçilen fonun performans isteğini mevcut servise iletir", async () => {
    const controller = new AbortController()
    apiMocks.fetchFundMonitoring.mockResolvedValue({ fund: FUNDS[0] })

    await loadFundPerformance("fund-1", controller.signal)

    expect(apiMocks.fetchFundMonitoring).toHaveBeenCalledWith(
      "fund-1",
      controller.signal,
    )
  })
})
