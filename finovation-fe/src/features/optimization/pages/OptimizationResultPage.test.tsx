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
      </Routes>
    </MemoryRouter>,
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
    ).toHaveBeenCalledWith(1, [])
  })

  it("onaylayınca PDF İndir butonunu gösterir ve tıklanınca export'u tetikler", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    renderPage("Finovation Atlas Fonu")

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "PDF İndir" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "PDF İndir" }))

    await waitFor(() =>
      expect(pdfExportMocks.downloadOptimizationResultPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          fundName: "Finovation Atlas Fonu",
          request: expect.objectContaining({ id: 1 }),
        }),
      ),
    )
  })

  it("onaylayınca Excel İndir butonunu gösterir ve tıklanınca export'u tetikler", async () => {
    const user = userEvent.setup()
    optimizationApiMocks.approveOptimizationRequest.mockResolvedValue({})
    renderPage("Finovation Atlas Fonu")

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Onaya İlerle →" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Onaya İlerle →" }))
    await user.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Excel İndir" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Excel İndir" }))

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

  it("reddedince başarı ekranını farklı metinle gösterir ve PDF/Excel İndir butonlarını göstermez", async () => {
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
    expect(
      screen.queryByRole("button", { name: "PDF İndir" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Excel İndir" }),
    ).not.toBeInTheDocument()
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
    optimizationApiMocks.fetchOptimizationResult.mockResolvedValue(
      RED_SECTOR_RESULT,
    )
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
  })
})
