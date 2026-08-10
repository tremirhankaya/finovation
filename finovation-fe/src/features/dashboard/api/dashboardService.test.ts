import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  fetchFundMonitoring: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => ({
  apiFetch: apiMocks.apiFetch,
}))

vi.mock(
  "@/features/fund-monitoring/api/fundMonitoringService",
  async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/fund-monitoring/api/fundMonitoringService")>()),
    fetchFundMonitoring: apiMocks.fetchFundMonitoring,
  }),
)

import {
  loadDashboardOverview,
  loadFundPerformance,
} from "@/features/dashboard/api/dashboardService"

const DASHBOARD_RESPONSE = {
  businessDate: "2025-05-29",
  funds: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Büyüme Fonu",
      type: "EQUITY_INTENSIVE",
      currency: "TRY",
      inceptionDate: "2026-08-01",
    },
  ],
  drafts: [
    {
      draftId: "22222222-2222-4222-8222-222222222222",
      name: null,
      currentStep: 4,
      status: "IN_PROGRESS",
      updatedAt: "2026-08-09T10:00:00",
    },
  ],
  optimizationLogs: [
    {
      requestId: 11,
      fundId: "11111111-1111-4111-8111-111111111111",
      fundName: "Büyüme Fonu",
      requestedByUsername: "user",
      requestedByDisplayName: "User Name",
      decidedByUserId: null,
      decidedByUsername: null,
      decidedByDisplayName: null,
      status: "COMPLETED",
      errorMessage: null,
      rejectionReason: null,
      createdAt: "2026-08-09T10:00:00",
      completedAt: "2026-08-09T10:05:00",
      updatedAt: "2026-08-09T10:05:00",
      resultAvailable: true,
    },
  ],
  latestOptimizationResult: {
    generatedAt: "2026-08-09T10:05:00",
    assets: [],
    metrics: [{ key: "VOLATILITY", currentValue: 24, proposedValue: 20 }],
  },
  stressTests: [
    {
      testId: "33333333-3333-4333-8333-333333333333",
      scenarioCode: "GLOBAL_CRISIS",
      scenarioName: "Küresel Kriz",
      asOfDate: "2026-08-08",
      portfolioImpact: -0.08,
      createdAt: "2026-08-08T15:00:00",
    },
  ],
  unavailableSections: [],
}

describe("dashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.apiFetch.mockImplementation(
      async (_url, _options, parse: (body: unknown) => unknown) =>
        parse(DASHBOARD_RESPONSE),
    )
  })

  it("aggregation endpointinden gelen dashboard özetini dönüştürür", async () => {
    const controller = new AbortController()
    const response = await loadDashboardOverview(controller.signal)

    expect(apiMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/dashboard/summary",
      {
        errorMessage: "Dashboard özeti yüklenemedi",
        signal: controller.signal,
      },
      expect.any(Function),
    )
    expect(response.data.funds).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Büyüme Fonu",
        type: "Hisse Senedi Yoğun Fon",
      },
    ])
    expect(response.data.businessDate).toBe("2025-05-29")
    expect(response.data.drafts).toHaveLength(1)
    expect(response.data.drafts[0]?.name).toBe("İsimsiz Fon Taslağı")
    expect(response.data.optimizationLogs).toHaveLength(1)
    expect(response.data.latestOptimizationResult).toEqual(
      DASHBOARD_RESPONSE.latestOptimizationResult,
    )
    expect(response.data.stressTests).toHaveLength(1)
    expect(response.errors).toEqual({
      funds: "",
      drafts: "",
      optimization: "",
      stressTests: "",
    })
  })

  it("geçersiz aggregation cevabını kabul etmez", async () => {
    apiMocks.apiFetch.mockImplementation(
      async (_url, _options, parse: (body: unknown) => unknown) =>
        parse({ ...DASHBOARD_RESPONSE, funds: [{ id: "geçersiz" }] }),
    )

    await expect(loadDashboardOverview()).rejects.toThrow()
  })

  it("ulaşılamayan bölümleri kullanıcı mesajlarına dönüştürür", async () => {
    apiMocks.apiFetch.mockImplementation(
      async (_url, _options, parse: (body: unknown) => unknown) =>
        parse({
          ...DASHBOARD_RESPONSE,
          funds: [],
          unavailableSections: ["FUNDS", "STRESS_TESTS"],
        }),
    )

    const response = await loadDashboardOverview()

    expect(response.data.funds).toEqual([])
    expect(response.errors).toEqual({
      funds: "Fon bilgileri yüklenemedi.",
      drafts: "",
      optimization: "",
      stressTests: "Stres testi özeti yüklenemedi.",
    })
  })

  it("seçilen fonun performans isteğini mevcut servise iletir", async () => {
    const controller = new AbortController()
    apiMocks.fetchFundMonitoring.mockResolvedValue({
      fund: {
        id: "fund-1",
        name: "Büyüme Fonu",
        type: "Hisse Senedi Yoğun Fon",
      },
    })

    await loadFundPerformance("fund-1", controller.signal)

    expect(apiMocks.fetchFundMonitoring).toHaveBeenCalledWith(
      "fund-1",
      controller.signal,
    )
  })
})
