import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  createOptimizationRequest: vi.fn(),
  fetchInvestmentUniverse: vi.fn(),
  fetchOptimizableFunds: vi.fn(),
  fetchOptimizationFundPositions: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

import OptimizationFormPage from "@/features/optimization/pages/OptimizationFormPage"

const FUND = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Finovation Atlas Fonu",
  type: "EQUITY_INTENSIVE" as const,
  active: true,
  lastOptimizationDate: "2026-07-28",
  stockCount: 25,
  sectorCount: 12,
  equityWeightPercent: 90,
  tppWeightPercent: 10,
}

function snapshot() {
  return {
    fundName: FUND.name,
    positions: [
      {
        assetId: "AKBNK",
        symbol: "AKBNK",
        name: "Akbank",
        sectorName: "Bankacılık",
        weightPercentage: 8,
      },
    ],
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
        <Route
          path="/optimization-requests/logs"
          element={<div>Loglar ekranı</div>}
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
    optimizationApiMocks.fetchOptimizableFunds.mockReset().mockResolvedValue([FUND])
    optimizationApiMocks.fetchOptimizationFundPositions
      .mockReset()
      .mockResolvedValue(snapshot())
    optimizationApiMocks.createOptimizationRequest.mockReset()
    optimizationApiMocks.fetchInvestmentUniverse
      .mockReset()
      .mockResolvedValue([
        { assetCode: "MGROS", name: "Migros", sectorName: "Perakende Ticaret" },
      ])
  })

  it("fon verileri yüklenirken yükleniyor bandı gösterir", () => {
    optimizationApiMocks.fetchOptimizableFunds.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(screen.getByRole("status")).toHaveTextContent("Fonlar yükleniyor…")
  })

  it("optimize edilebilir fon yoksa ayrı boş durum ekranını gösterir", async () => {
    optimizationApiMocks.fetchOptimizableFunds.mockResolvedValue([])
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

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(screen.getByText("Akbank")).toBeInTheDocument()
  })

  it("hisse sayısı aralığı kaydırıcısı minWidth'in altına daralamaz", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    const minSlider = screen.getByRole("slider", {
      name: "Hisse Sayısı Aralığı Minimum kaydırıcı",
    })
    fireEvent.change(minSlider, { target: { value: "29" } })

    expect(
      screen.getByRole("textbox", { name: "Hisse Sayısı Aralığı Minimum" }),
    ).toHaveValue("25")
    expect(
      screen.getByRole("textbox", { name: "Hisse Sayısı Aralığı Maksimum" }),
    ).toHaveValue("30")
    expect(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    ).toBeEnabled()
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

  it("Varsayılana Dön başlangıçta pasif, kısıt değiştirilince aktifleşip varsayılana döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    expect(
      screen.getByRole("button", { name: "Varsayılana Dön" }),
    ).toBeDisabled()

    const tppMinSlider = screen.getByRole("slider", {
      name: "TPP Ağırlık Aralığı (%) Minimum kaydırıcı",
    })
    fireEvent.change(tppMinSlider, { target: { value: "9" } })

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Varsayılana Dön" }),
      ).toBeEnabled(),
    )
    expect(
      screen.getByRole("textbox", { name: "TPP Ağırlık Aralığı (%) Minimum" }),
    ).toHaveValue("9")

    await user.click(screen.getByRole("button", { name: "Varsayılana Dön" }))

    expect(
      screen.getByRole("textbox", { name: "TPP Ağırlık Aralığı (%) Minimum" }),
    ).toHaveValue("8")
    expect(
      screen.getByRole("button", { name: "Varsayılana Dön" }),
    ).toBeDisabled()
  })

  it("B panelinde çıkarılan hisse C panelinde en üstte rozetle görünür ve C'nin kendi sınırını etkilemez", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    await user.click(
      screen.getByRole("checkbox", { name: "AKBNK hissesini çıkar" }),
    )

    const pinnedCheckbox = screen.getByRole("checkbox", {
      name: "AKBNK hissesi için Hariç Tut (B panelinden)",
    })
    expect(pinnedCheckbox).toBeChecked()
    expect(screen.getByText("Yukarıdan")).toBeInTheDocument()

    await user.click(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    )

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    ).toBeChecked()
  })

  it("C'de hariç tutulan hisse D'de görünmez, seçim kaldırılınca geri gelir", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    )

    expect(
      screen.queryByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Hariç Tut" }),
    )

    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("checkbox", { name: "MGROS hissesi için Ekle" }),
    ).not.toBeChecked()
  })

  it("Fon Değiştir butonu fon seçimi adımına döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    await user.click(screen.getByRole("button", { name: "Fon Değiştir" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Optimizasyona Başla" }),
      ).toBeInTheDocument(),
    )
  })

  it("1. adımda İşlem Loglarını Gör butonu loglar ekranına götürür", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "İşlem Loglarını Gör" }),
      ).toBeInTheDocument(),
    )

    await user.click(
      screen.getByRole("button", { name: "İşlem Loglarını Gör" }),
    )

    await waitFor(() =>
      expect(screen.getByText("Loglar ekranı")).toBeInTheDocument(),
    )
  })

  it("2. adımda İşlem Loglarını Gör butonu görünmez, Fon Değiştir görünür", async () => {
    const user = userEvent.setup()
    renderPage()

    await continueToPreferencesStep(user)

    expect(
      screen.queryByRole("button", { name: "İşlem Loglarını Gör" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Fon Değiştir" }),
    ).toBeInTheDocument()
  })
})
