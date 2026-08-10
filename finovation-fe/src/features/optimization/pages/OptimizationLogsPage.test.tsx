import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

const optimizationApiMocks = vi.hoisted(() => ({
  fetchOptimizationLogs: vi.fn(),
}))

vi.mock("@/features/optimization/api/optimizationApi", () => ({
  ...optimizationApiMocks,
}))

import OptimizationLogsPage from "@/features/optimization/pages/OptimizationLogsPage"

const LOGS = [
  {
    requestId: 42,
    fundId: "11111111-1111-4111-8111-111111111111",
    fundName: "Optimizasyon Stabil Fon",
    requestedByUsername: "sefa.ecir",
    status: "COMPLETED" as const,
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
    status: "FAILED" as const,
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
  it("lists every log row with its fund, status and PDF availability", async () => {
    renderPage()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("Optimizasyon Stabil Fon")).toBeVisible()
    expect(within(table).getByText("Aktif Hisse Fonu")).toBeVisible()
    expect(within(table).getByText("Tamamlandı")).toBeVisible()
    expect(within(table).getByText("Başarısız")).toBeVisible()

    const rows = within(table).getAllByRole("row")
    const completedRow = rows.find((row) =>
      within(row).queryByText("Optimizasyon Stabil Fon"),
    )
    const failedRow = rows.find((row) =>
      within(row).queryByText("Aktif Hisse Fonu"),
    )

    expect(
      within(completedRow as HTMLElement).getByRole("button", {
        name: /PDF/,
      }),
    ).toBeEnabled()
    expect(
      within(failedRow as HTMLElement).getByRole("button", { name: /PDF/ }),
    ).toBeDisabled()
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

  it("downloads a per-row PDF using the result data loader", async () => {
    vi.doMock("@/features/optimization/lib/optimizationResultPdfData", () => ({
      loadOptimizationResultPdfInput: vi.fn().mockResolvedValue({}),
    }))
    vi.doMock("@/features/optimization/lib/optimizationPdfExport", () => ({
      downloadOptimizationResultPdf: vi.fn().mockResolvedValue(undefined),
    }))

    const user = userEvent.setup()
    renderPage()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row")
    const completedRow = rows.find((row) =>
      within(row).queryByText("Optimizasyon Stabil Fon"),
    ) as HTMLElement

    await user.click(within(completedRow).getByRole("button", { name: /PDF/ }))

    const { loadOptimizationResultPdfInput } = await import(
      "@/features/optimization/lib/optimizationResultPdfData"
    )
    await waitFor(() => {
      expect(loadOptimizationResultPdfInput).toHaveBeenCalledWith(
        42,
        "Optimizasyon Stabil Fon",
      )
    })
  })
})
