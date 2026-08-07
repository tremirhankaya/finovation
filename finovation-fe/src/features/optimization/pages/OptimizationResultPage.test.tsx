import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationRequest: vi.fn(),
  approveOptimizationRequest: vi.fn(),
  rejectOptimizationRequest: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

const metricsPlaceholderMocks = vi.hoisted(() => ({
  PLACEHOLDER_CONSTRAINT_METRIC_INPUT: {
    totalEquityWeight: 90,
    tppWeight: 9,
    tppUserMin: 5,
    tppUserMax: 15,
    stockCount: 22,
    stockCountUserMin: 16,
    stockCountUserMax: 30,
    maxSingleStockWeight: 7,
    maxSectorConcentration: 20,
  },
  PLACEHOLDER_CURRENT_RISK_METRICS: {
    beta: 1,
    volatility: 18,
    maxDrawdown: -20,
    downsideDeviation: 12,
    trackingError: 3,
    sharpeRatio: 0.9,
    calmarRatio: 0.4,
    informationRatio: 0.3,
    alpha: 1,
  },
  PLACEHOLDER_PROPOSED_RISK_METRICS: {
    beta: 0.9,
    volatility: 16,
    maxDrawdown: -18,
    downsideDeviation: 10,
    trackingError: 2.5,
    sharpeRatio: 1.1,
    calmarRatio: 0.5,
    informationRatio: 0.4,
    alpha: 1.5,
  },
}))

vi.mock(
  "@/features/optimization/lib/optimizationMetricsPlaceholder",
  () => metricsPlaceholderMocks,
)

import OptimizationResultPage from "@/features/optimization/pages/OptimizationResultPage"

const COMPLETED_REQUEST = {
  id: 1,
  fundId: 42,
  dataTimestamp: null,
  modelVersion: null,
  requestedByUserId: 7,
  requestedByUsername: "fon-yoneticisi",
  riskProfile: "BALANCED",
  status: "COMPLETED",
  startedAt: null,
  completedAt: "2026-08-07T09:00:00",
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:00:00",
} as const

function renderPage(fundName?: string) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/optimization-requests/1/result",
          state: fundName ? { fundName } : undefined,
        },
      ]}
    >
      <Routes>
        <Route
          path="/optimization-requests/:requestId/result"
          element={<OptimizationResultPage />}
        />
        <Route
          path="/optimization-requests/new"
          element={<div>Yeni optimizasyon</div>}
        />
        <Route
          path="/optimization-requests/:requestId/running"
          element={<div>Çalıştırma ekranı</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("OptimizationResultPage", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizationRequest
      .mockReset()
      .mockResolvedValue(COMPLETED_REQUEST)
    optimizationApiMocks.approveOptimizationRequest.mockReset()
    optimizationApiMocks.rejectOptimizationRequest.mockReset()
  })

  it("yüklenirken durum bandını gösterir", () => {
    optimizationApiMocks.fetchOptimizationRequest.mockReturnValue(
      new Promise(() => undefined),
    )
    renderPage()

    expect(screen.getByRole("status")).toHaveTextContent(
      "Optimizasyon isteği yükleniyor…",
    )
  })

  it("istek COMPLETED değilse incelemeyi engeller", async () => {
    optimizationApiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "RUNNING",
    })
    renderPage()

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(screen.getByRole("alert")).toHaveTextContent("RUNNING")
  })

  it("3. adımda karşılaştırma tablosunu ve gerekçe panelini gösterir", async () => {
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Varlık Bazlı Karşılaştırma/ }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("heading", {
        name: /Portföy Kriterleri ve Gerekçeler/,
      }),
    ).toBeInTheDocument()
  })

  it("fundName state'te yoksa ham fon ID'sini gösterir", async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText(/Fon #42/)).toBeInTheDocument())
  })

  it("fundName state'ten geldiğinde ham fon ID'si yerine onu gösterir", async () => {
    renderPage("Deneme Hisse Fonu")

    await waitFor(() =>
      expect(screen.getByText(/Deneme Hisse Fonu/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Fon #42/)).not.toBeInTheDocument()
  })

  it("onaya ilerle ile 4. adıma geçer", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))

    expect(
      screen.getByRole("heading", { name: "Onay Özeti" }),
    ).toBeInTheDocument()
  })

  it("onaylayınca başarı ekranını gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() =>
      expect(screen.getByText("Optimizasyon Onaylandı")).toBeInTheDocument(),
    )
    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).toHaveBeenCalledWith(1)
  })

  it("reddedince başarı ekranını farklı metinle gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.rejectOptimizationRequest.mockResolvedValue({})
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "Reddet" }))

    await waitFor(() =>
      expect(screen.getByText("Optimizasyon Reddedildi")).toBeInTheDocument(),
    )
  })

  it("onay hata verdiğinde hata bandını gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.approveOptimizationRequest.mockRejectedValue(
      new Error("network"),
    )
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
  })

  it("sonuca dön butonu 3. adıma geri döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "← Sonuca Dön" }))

    expect(
      screen.getByRole("heading", { name: /Varlık Bazlı Karşılaştırma/ }),
    ).toBeInTheDocument()
  })

  it("istek zaten APPROVED ise doğrudan başarı ekranını gösterir", async () => {
    optimizationApiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "APPROVED",
    })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText("Optimizasyon Onaylandı")).toBeInTheDocument(),
    )
  })

  it("kısıt metriği kırmızıysa Onayla butonunu devre dışı bırakır", async () => {
    const user = userEvent.setup()
    metricsPlaceholderMocks.PLACEHOLDER_CONSTRAINT_METRIC_INPUT.maxSectorConcentration = 40
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))

    expect(screen.getByRole("button", { name: "Onayla" })).toBeDisabled()
    expect(
      screen.getByText(/Kısıt metriklerinden en az biri kırmızı durumda/),
    ).toBeInTheDocument()

    metricsPlaceholderMocks.PLACEHOLDER_CONSTRAINT_METRIC_INPUT.maxSectorConcentration = 20
  })
})
