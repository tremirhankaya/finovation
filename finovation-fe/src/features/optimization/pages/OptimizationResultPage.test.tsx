import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationRequest: vi.fn(),
  fetchOptimizationResult: vi.fn(),
  approveOptimizationRequest: vi.fn(),
  rejectOptimizationRequest: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

const pdfExportMocks = vi.hoisted(() => ({
  downloadOptimizationResultPdf: vi.fn(),
}))

vi.mock("@/features/optimization/lib/optimizationPdfExport", () => ({
  ...pdfExportMocks,
}))

const excelExportMocks = vi.hoisted(() => ({
  downloadOptimizationResultExcel: vi.fn(),
}))

vi.mock("@/features/optimization/lib/optimizationExcelExport", () => ({
  ...excelExportMocks,
}))

const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: useAuthMock,
}))

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
  tppMinWeight: 5,
  tppMaxWeight: 15,
  stockCountMin: 16,
  stockCountMax: 30,
  startedAt: null,
  completedAt: "2026-08-07T09:00:00",
  errorMessage: null,
  createdAt: "2026-08-06T10:00:00",
  updatedAt: "2026-08-06T10:00:00",
} as const

const COMPLIANT_SECTORS = ["Bankacılık", "Savunma", "Perakende", "Enerji"]

const COMPLIANT_RESULT = {
  generatedAt: "2026-08-07T09:00:00",
  assets: [
    ...Array.from({ length: 16 }, (_unused, index) => ({
      assetCode: `STK${index}`,
      name: `Hisse ${index}`,
      sectorName: COMPLIANT_SECTORS[index % COMPLIANT_SECTORS.length],
      assetType: "EQUITY" as const,
      currentWeight: 5.375,
      proposedWeight: 5.375,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    })),
    {
      assetCode: "TPP1G",
      name: "TPP",
      sectorName: null,
      assetType: "TPP" as const,
      currentWeight: 14,
      proposedWeight: 14,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    },
  ],
  metrics: [],
}

const RED_SECTOR_RESULT = {
  generatedAt: "2026-08-07T09:00:00",
  assets: [
    {
      assetCode: "STK0",
      name: "Hisse 0",
      sectorName: "Bankacılık",
      assetType: "EQUITY" as const,
      currentWeight: 40,
      proposedWeight: 40,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    },
    {
      assetCode: "TPP1G",
      name: "TPP",
      sectorName: null,
      assetType: "TPP" as const,
      currentWeight: 60,
      proposedWeight: 60,
      finalWeight: null,
      changeAmount: 0,
      actionType: "KEEP" as const,
      manuallyOverridden: false,
      rationale: null,
    },
  ],
  metrics: [],
}

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
        <Route path="/fund-monitoring" element={<div>Fon izleme</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function goToCriteriaScreen(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Portföy Kriterlerini Gör" }),
    ).toBeInTheDocument(),
  )
  await user.click(
    screen.getByRole("button", { name: "Portföy Kriterlerini Gör" }),
  )
}

describe("OptimizationResultPage", () => {
  beforeEach(() => {
    optimizationApiMocks.fetchOptimizationRequest
      .mockReset()
      .mockResolvedValue(COMPLETED_REQUEST)
    optimizationApiMocks.fetchOptimizationResult
      .mockReset()
      .mockResolvedValue(COMPLIANT_RESULT)
    optimizationApiMocks.approveOptimizationRequest.mockReset()
    optimizationApiMocks.rejectOptimizationRequest.mockReset()
    pdfExportMocks.downloadOptimizationResultPdf.mockReset()
    excelExportMocks.downloadOptimizationResultExcel.mockReset()
    useAuthMock.mockReset().mockReturnValue({
      user: { username: "fon-yoneticisi", firstName: "Sefa", lastName: "Ecir" },
      signOut: vi.fn(),
    })
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

  it("3. adımda karşılaştırma tablosunu ve aksiyon butonlarını gösterir", async () => {
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Mevcut vs\. Optimize Edilmiş/ }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("button", { name: "Portföy Kriterlerini Gör" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tercihleri Değiştir" }),
    ).toBeInTheDocument()
  })

  it("fundName state'te yoksa ham fon ID'sini gösterir", async () => {
    renderPage()

    await waitFor(() =>
      expect(screen.getAllByText(/Fon #42/).length).toBeGreaterThan(0),
    )
  })

  it("fundName state'ten geldiğinde ham fon ID'si yerine onu gösterir", async () => {
    renderPage("Deneme Hisse Fonu")

    await waitFor(() =>
      expect(screen.getAllByText(/Deneme Hisse Fonu/).length).toBeGreaterThan(0),
    )
    expect(screen.queryByText(/Fon #42/)).not.toBeInTheDocument()
  })

  it("tercihleri değiştir butonu forma geri döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Tercihleri Değiştir" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Tercihleri Değiştir" }))

    expect(screen.getByText("Yeni optimizasyon")).toBeInTheDocument()
  })

  it("portföy kriterlerini gör ile kriter ekranına geçer", async () => {
    const user = userEvent.setup()
    renderPage()

    await goToCriteriaScreen(user)

    expect(
      screen.getByRole("heading", {
        name: /Portföy Kriterleri ve Model Gerekçeleri/,
      }),
    ).toBeInTheDocument()
  })

  it("onaylayınca başarı ekranını gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    renderPage()

    await goToCriteriaScreen(user)
    await user.click(
      screen.getByRole("button", { name: "Portföyü Onayla ve Güncelle" }),
    )

    await waitFor(() =>
      expect(screen.getByText("Optimizasyon Tamamlandı")).toBeInTheDocument(),
    )
    expect(
      optimizationApiMocks.approveOptimizationRequest,
    ).toHaveBeenCalledWith(1, [])
  })

  it("kriter ekranında PDF olarak indir butonuna tıklanınca export'u tetikler", async () => {
    const user = userEvent.setup()
    renderPage("Finovation Atlas Fonu")

    await goToCriteriaScreen(user)
    await user.click(
      screen.getByRole("button", { name: "↓ Analizi PDF Olarak İndir" }),
    )

    await waitFor(() =>
      expect(pdfExportMocks.downloadOptimizationResultPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          fundName: "Finovation Atlas Fonu",
          request: expect.objectContaining({ id: 1 }),
        }),
      ),
    )
  })

  it("kriter ekranında Excel olarak indir butonuna tıklanınca export'u tetikler", async () => {
    const user = userEvent.setup()
    renderPage("Finovation Atlas Fonu")

    await goToCriteriaScreen(user)
    await user.click(
      screen.getByRole("button", { name: "↓ Excel Olarak İndir" }),
    )

    await waitFor(() =>
      expect(
        excelExportMocks.downloadOptimizationResultExcel,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          fundName: "Finovation Atlas Fonu",
          request: expect.objectContaining({ id: 1 }),
        }),
      ),
    )
  })

  it("iptal edince başarı ekranını farklı metinle gösterir", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.rejectOptimizationRequest.mockResolvedValue({})
    renderPage()

    await goToCriteriaScreen(user)
    await user.click(
      screen.getByRole("button", { name: "Optimizasyonu İptal Et" }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Emin misiniz? · İptal Etmek İçin Tıklayın",
      }),
    )

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

    await goToCriteriaScreen(user)
    await user.click(
      screen.getByRole("button", { name: "Portföyü Onayla ve Güncelle" }),
    )

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
  })

  it("ağırlıkları düzenle karşılaştırma ekranına düzenlenebilir modda döner", async () => {
    const user = userEvent.setup()
    renderPage()

    await goToCriteriaScreen(user)
    await user.click(screen.getByRole("button", { name: "Ağırlıkları Düzenle" }))

    expect(
      screen.getByRole("heading", { name: /Mevcut vs\. Optimize Edilmiş/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText(/final ağırlığı/).length).toBeGreaterThan(0)
  })

  it("istek zaten APPROVED ise doğrudan başarı ekranını gösterir", async () => {
    optimizationApiMocks.fetchOptimizationRequest.mockResolvedValue({
      ...COMPLETED_REQUEST,
      status: "APPROVED",
    })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText("Optimizasyon Tamamlandı")).toBeInTheDocument(),
    )
  })

  it("kısıt metriği kırmızıysa Portföyü Onayla ve Güncelle butonunu devre dışı bırakır", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.fetchOptimizationResult.mockResolvedValue(
      RED_SECTOR_RESULT,
    )
    renderPage()

    await goToCriteriaScreen(user)

    expect(
      screen.getByRole("button", { name: "Portföyü Onayla ve Güncelle" }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Kısıt metriklerinden en az biri kırmızı durumda/),
    ).toBeInTheDocument()
  })
})
