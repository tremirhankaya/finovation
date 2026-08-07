import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fundMonitoringMocks = vi.hoisted(() => ({
  fetchFunds: vi.fn(),
  fetchFundMonitoring: vi.fn(),
}))
const optimizationApiMocks = vi.hoisted(() => ({
  createOptimizationRequest: vi.fn(),
}))

vi.mock(
  "@/features/fund-monitoring/api/fundMonitoringService",
  () => fundMonitoringMocks,
)
vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"

const FUND = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Finovation Atlas Fonu",
  type: "Hisse Senedi Yoğun Fon",
}

function snapshot() {
  return {
    fund: FUND,
    asOfDate: "2026-08-04",
    currency: "TRY",
    currentSharePrice: 100,
    dailyChangePercentage: 0,
    priceHistory: {},
    technicalIndicators: [],
    periodReturns: [],
    positions: [
      {
        assetId: "AKBNK",
        symbol: "AKBNK",
        name: "Akbank",
        sectorName: "Bankacılık",
        weightPercentage: 8,
      },
    ],
    sectorAllocations: [],
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/optimization-requests/new"]}>
      <Routes>
        <Route
          path="/optimization-requests/new"
          element={<OptimizationFormPage />}
        />
        <Route
          path="/optimization-requests/:requestId/running"
          element={<div>Çalıştırma ekranı</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

async function continueToPreferencesStep(
  user: ReturnType<typeof userEvent.setup>,
) {
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Optimizasyona Başla" }),
    ).toBeEnabled(),
  )
  await user.click(screen.getByRole("button", { name: "Optimizasyona Başla" }))
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    ).toBeInTheDocument(),
  )
}

describe("OptimizationFormPage", () => {
  beforeEach(() => {
    fundMonitoringMocks.fetchFunds.mockReset().mockResolvedValue([FUND])
    fundMonitoringMocks.fetchFundMonitoring
      .mockReset()
      .mockResolvedValue(snapshot())
    optimizationApiMocks.createOptimizationRequest.mockReset()
  })

  it("fon verileri yüklenirken yükleniyor bandı gösterir", () => {
    fundMonitoringMocks.fetchFunds.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole("status")).toHaveTextContent("Fonlar yükleniyor…")
  })

  it("optimize edilebilir fon yoksa ayrı boş durum ekranını gösterir", async () => {
    fundMonitoringMocks.fetchFunds.mockResolvedValue([])
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByText("Optimize edilebilecek bir fon bulunamadı."),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: "Fon Oluşturma Ekranına Git" }),
    ).toBeInTheDocument()
  })

  it("1. adımda fonu listeler, devam edince 2. adıma geçip pozisyonları gösterir", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() =>
      expect(screen.getByText("Finovation Atlas Fonu")).toBeInTheDocument(),
    )

    await continueToPreferencesStep(user)

    expect(screen.getByText(/AKBNK Akbank/)).toBeInTheDocument()
  })

  it("hisse sayısı aralığı çok darsa çalıştır butonunu devre dışı bırakır", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    const minInput = screen.getByRole("spinbutton", {
      name: "Hisse Sayısı Aralığı minimum",
    })
    await user.clear(minInput)
    await user.type(minInput, "34")

    expect(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    ).toBeDisabled()
  })

  it("başarılı gönderim sonrası çalıştırma ekranına yönlendirir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.createOptimizationRequest.mockResolvedValue({
      id: 42,
    })
    renderPage()

    await continueToPreferencesStep(user)

    await user.click(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    )

    await waitFor(() =>
      expect(screen.getByText("Çalıştırma ekranı")).toBeInTheDocument(),
    )
  })

  it("gönderim hata verdiğinde hata bandını gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.createOptimizationRequest.mockRejectedValue(
      new Error("network"),
    )
    renderPage()

    await continueToPreferencesStep(user)

    await user.click(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    )

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
  })

  it("geri dön bağlantısı fon seçimi adımına döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    await user.click(screen.getByRole("button", { name: "← Fon seçimine dön" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Optimizasyona Başla" }),
      ).toBeInTheDocument(),
    )
  })
})
