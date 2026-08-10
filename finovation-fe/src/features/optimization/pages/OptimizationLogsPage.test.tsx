import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationLogs: vi.fn(),
}))

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  )
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

import OptimizationLogsPage from "@/features/optimization/pages/OptimizationLogsPage"

const LOGS = [
  {
    requestId: 42,
    fundId: "11111111-1111-4111-8111-111111111111",
    fundName: "Optimizasyon Stabil Fon",
    requestedByUsername: "sefa.ecir",
    decidedByUserId: 3,
    decidedByUsername: "onaylayan",
    decidedByDisplayName: "Onay Veren",
    status: "APPROVED" as const,
    errorMessage: null,
    createdAt: "2026-08-09T09:25:02",
    completedAt: "2026-08-09T09:25:10",
    updatedAt: "2026-08-09T09:25:10",
    resultAvailable: true,
  },
  {
    requestId: 41,
    fundId: "22222222-2222-4222-8222-222222222222",
    fundName: "Aktif Hisse Fonu",
    requestedByUsername: "sefa.ecir",
    decidedByUserId: null,
    decidedByUsername: null,
    decidedByDisplayName: null,
    status: "FAILED" as const,
    errorMessage: "Motor sunucusuna bağlanılamadı",
    createdAt: "2026-08-05T14:10:00",
    completedAt: null,
    updatedAt: "2026-08-05T14:10:05",
    resultAvailable: false,
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <OptimizationLogsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  optimizationApiMocks.fetchOptimizationLogs.mockResolvedValue(LOGS)
})

describe("OptimizationLogsPage", () => {
  it("lists every log row with its fund, decider, status and PDF/Excel availability", async () => {
    renderPage()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("Optimizasyon Stabil Fon")).toBeVisible()
    expect(within(table).getByText("Aktif Hisse Fonu")).toBeVisible()
    expect(within(table).getByText("Onaylandı")).toBeVisible()
    expect(within(table).getByText("Başarısız")).toBeVisible()
    expect(within(table).getByText("Onay Veren")).toBeVisible()
    expect(within(table).getByText("sefa.ecir")).toBeVisible()
    expect(within(table).queryByText("Hazırlanıyor")).not.toBeInTheDocument()

    const rows = within(table).getAllByRole("row")
    const approvedRow = rows.find((row) =>
      within(row).queryByText("Optimizasyon Stabil Fon"),
    ) as HTMLElement
    const failedRow = rows.find((row) =>
      within(row).queryByText("Aktif Hisse Fonu"),
    ) as HTMLElement

    expect(
      within(approvedRow).getByRole("button", { name: /PDF/ }),
    ).toBeEnabled()
    expect(
      within(approvedRow).getByRole("button", { name: /Excel/ }),
    ).toBeEnabled()
    expect(
      within(failedRow).getByRole("button", { name: /PDF/ }),
    ).toBeDisabled()
    expect(
      within(failedRow).getByRole("button", { name: /Excel/ }),
    ).toBeDisabled()
    expect(within(failedRow).getByText("Başarısız")).toHaveAttribute(
      "title",
      "Motor sunucusuna bağlanılamadı",
    )
  })

  it("navigates back to the optimization flow", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole("table")
    await user.click(
      screen.getByRole("button", { name: /Fon Optimizasyonuna Dön/ }),
    )

    expect(navigateMock).toHaveBeenCalledWith("/optimization-requests/new")
  })

  it("filters rows by fund", async () => {
    const user = userEvent.setup()
    renderPage()

    const table = await screen.findByRole("table")
    within(table).getByText("Optimizasyon Stabil Fon")

    await user.selectOptions(
      screen.getByLabelText("Fon"),
      "Optimizasyon Stabil Fon",
    )

    expect(within(table).getByText("Optimizasyon Stabil Fon")).toBeVisible()
    expect(within(table).queryByText("Aktif Hisse Fonu")).not.toBeInTheDocument()
    expect(screen.getByText("1 kayıt")).toBeVisible()
  })

  it("shows an error banner when the request fails", async () => {
    optimizationApiMocks.fetchOptimizationLogs.mockRejectedValue(
      new Error("network down"),
    )
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeVisible()
    })
  })

  it("downloads a per-row PDF using the shared result export loader", async () => {
    vi.doMock("@/features/optimization/lib/optimizationResultExportData", () => ({
      loadOptimizationResultExportInput: vi.fn().mockResolvedValue({}),
    }))
    vi.doMock("@/features/optimization/lib/optimizationPdfExport", () => ({
      downloadOptimizationResultPdf: vi.fn().mockResolvedValue(undefined),
    }))

    const user = userEvent.setup()
    renderPage()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row")
    const approvedRow = rows.find((row) =>
      within(row).queryByText("Optimizasyon Stabil Fon"),
    ) as HTMLElement

    await user.click(within(approvedRow).getByRole("button", { name: /PDF/ }))

    const { loadOptimizationResultExportInput } = await import(
      "@/features/optimization/lib/optimizationResultExportData"
    )
    await waitFor(() => {
      expect(loadOptimizationResultExportInput).toHaveBeenCalledWith(
        42,
        "Optimizasyon Stabil Fon",
      )
    })
  })

  it("downloads a per-row Excel report using the same fresh result export loader", async () => {
    vi.doMock("@/features/optimization/lib/optimizationResultExportData", () => ({
      loadOptimizationResultExportInput: vi.fn().mockResolvedValue({}),
    }))
    vi.doMock("@/features/optimization/lib/optimizationExcelExport", () => ({
      downloadOptimizationResultExcel: vi.fn().mockResolvedValue(undefined),
    }))

    const user = userEvent.setup()
    renderPage()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row")
    const approvedRow = rows.find((row) =>
      within(row).queryByText("Optimizasyon Stabil Fon"),
    ) as HTMLElement

    await user.click(
      within(approvedRow).getByRole("button", { name: /Excel/ }),
    )

    const { loadOptimizationResultExportInput } = await import(
      "@/features/optimization/lib/optimizationResultExportData"
    )
    const { downloadOptimizationResultExcel } = await import(
      "@/features/optimization/lib/optimizationExcelExport"
    )
    await waitFor(() => {
      expect(loadOptimizationResultExportInput).toHaveBeenCalledWith(
        42,
        "Optimizasyon Stabil Fon",
      )
      expect(downloadOptimizationResultExcel).toHaveBeenCalled()
    })
  })
})
