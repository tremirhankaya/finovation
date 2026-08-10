import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

const dashboardMocks = vi.hoisted(() => ({
  useDashboard: vi.fn(),
}))

vi.mock("@/features/dashboard/hooks/useDashboard", () => dashboardMocks)
vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({
    user: { firstName: "Ayşe" },
  }),
}))

import DashboardPage from "@/features/dashboard/pages/DashboardPage"

const FUNDS = [
  { id: "fund-1", name: "Büyüme Fonu", type: "Hisse Senedi Yoğun Fon" },
  { id: "fund-2", name: "Denge Fonu", type: "Hisse Senedi Yoğun Fon" },
]

const SNAPSHOT = {
  fund: FUNDS[0],
  asOfDate: "2026-08-08",
  currency: "TRY",
  currentSharePrice: 18.4271,
  dailyChangePercentage: 1.24,
  priceHistory: {
    "1M": [
      { date: "2026-07-08", value: 17.2 },
      { date: "2026-08-08", value: 18.4271 },
    ],
  },
  benchmark: { name: "Benchmark", components: [] },
  technicalIndicators: [],
  periodReturns: [
    { period: "1M" as const, label: "1 Aylık Getiri", value: 4.2 },
  ],
  positions: [],
  sectorAllocations: [],
}

function readyDashboard() {
  return {
    funds: FUNDS,
    drafts: [
      {
        draftId: "11111111-1111-4111-8111-111111111111",
        name: "Teknoloji Fonu Taslağı",
        currentStep: 4,
        status: "IN_PROGRESS" as const,
        updatedAt: "2026-08-09T10:00:00",
      },
    ],
    optimizationLogs: [
      {
        requestId: 7,
        fundId: "fund-1",
        fundName: "Büyüme Fonu",
        requestedByUsername: "ayse",
        status: "COMPLETED" as const,
        createdAt: "2026-08-09T11:00:00",
        completedAt: "2026-08-09T11:04:00",
        updatedAt: "2026-08-09T11:04:00",
        resultAvailable: true,
      },
    ],
    latestOptimizationResult: {
      generatedAt: "2026-08-09T11:04:00",
      assets: [],
      metrics: [
        { key: "VOLATILITY", currentValue: 24.5, proposedValue: 20.1 },
        { key: "MAX_DRAWDOWN", currentValue: -18, proposedValue: -14 },
        { key: "SHARPE_RATIO", currentValue: 0.8, proposedValue: 1.2 },
      ],
    },
    stressTests: [
      {
        testId: "22222222-2222-4222-8222-222222222222",
        scenarioCode: "GLOBAL_CRISIS",
        scenarioName: "Küresel Kriz",
        asOfDate: "2026-08-08",
        portfolioImpact: -0.042,
        createdAt: "2026-08-09T12:00:00",
      },
    ],
    selectedFundId: "fund-1",
    monitoringSnapshot: SNAPSHOT,
    errors: {
      funds: "",
      drafts: "",
      optimization: "",
      stressTests: "",
      monitoring: "",
    },
    isOverviewLoading: false,
    isMonitoringLoading: false,
    selectFund: vi.fn(),
    reload: vi.fn(),
  }
}

describe("DashboardPage", () => {
  it("dört modülün özetini ve hızlı işlemleri birlikte gösterir", () => {
    dashboardMocks.useDashboard.mockReturnValue(readyDashboard())
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole("heading", { name: "Merhaba, Ayşe" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Genel özet")).toHaveTextContent(
      "Aktif Fonlar2",
    )
    expect(screen.getByLabelText("Genel özet")).toHaveTextContent(
      "Seçili Fon · 1A Getiri+%4,20",
    )
    expect(
      screen.getByRole("img", {
        name: "Büyüme Fonu pay fiyatı değişim grafiği",
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Küresel Kriz").length).toBeGreaterThan(0)
    expect(screen.getByText("Teknoloji Fonu Taslağı")).toBeInTheDocument()
    expect(screen.getByText("Sharpe Oranı")).toBeInTheDocument()

    expect(
      screen.getByRole("link", { name: /Yeni Fon Tasarla/ }),
    ).toHaveAttribute("href", "/fund-design/new")
    expect(
      screen.getByRole("link", { name: /Optimizasyon Başlat/ }),
    ).toHaveAttribute("href", "/optimization-requests/new")
    expect(screen.getByRole("link", { name: "Aktif fonlar" })).toHaveAttribute(
      "href",
      "/fund-design/active",
    )
    expect(screen.getByRole("link", { name: "Taslaklar" })).toHaveAttribute(
      "href",
      "/fund-design/create",
    )
  })

  it("fon seçimini ve manuel yenilemeyi hook'a iletir", async () => {
    const user = userEvent.setup()
    const dashboard = readyDashboard()
    dashboardMocks.useDashboard.mockReturnValue(dashboard)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    await user.selectOptions(
      screen.getByLabelText("Dashboard izlenen fon"),
      "fund-2",
    )
    await user.click(screen.getByRole("button", { name: "Verileri Yenile" }))

    expect(dashboard.selectFund).toHaveBeenCalledWith("fund-2")
    expect(dashboard.reload).toHaveBeenCalledOnce()
  })

  it("daha yeni bir optimizasyon devam ediyorsa KPI'da güncel durumu gösterir", () => {
    const dashboard = readyDashboard()
    dashboardMocks.useDashboard.mockReturnValue({
      ...dashboard,
      optimizationLogs: [
        {
          requestId: 8,
          fundId: "fund-2",
          fundName: "Denge Fonu",
          requestedByUsername: "ayse",
          status: "RUNNING" as const,
          createdAt: "2026-08-10T11:00:00",
          completedAt: null,
          updatedAt: "2026-08-10T11:01:00",
          resultAvailable: false,
        },
        ...dashboard.optimizationLogs,
      ],
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    const summary = screen.getByLabelText("Genel özet")
    expect(summary).toHaveTextContent("Son OptimizasyonÇalışıyorDenge Fonu")
  })
})
