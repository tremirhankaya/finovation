import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const systemLogsMocks = vi.hoisted(() => ({
  getSystemLogs: vi.fn(),
}))

vi.mock(
    "@/features/system-logs/api/systemLogsService",
    () => systemLogsMocks,
)

import SystemLogsPage from "@/features/system-logs/pages/SystemLogsPage"

describe("SystemLogsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    systemLogsMocks.getSystemLogs.mockResolvedValue([
      {
        timestamp: "2026-08-11T06:25:46.456Z",
        level: "INFO",
        service: "backend",
        message: "market data bootstrap finished",
      },
      {
        timestamp: "2026-08-11T06:25:47.456Z",
        level: "WARN",
        service: "fund-engine",
        message: "sample warning",
      },
      {
        timestamp: "2026-08-11T06:25:48.456Z",
        level: "ERROR",
        service: "backend",
        message: "sample error",
      },
    ])
  })

  it("API'den gelen log kayıtlarını gösterir", async () => {
    render(<SystemLogsPage />)

    expect(
        screen.getByRole("heading", { name: "Log İzleme" }),
    ).toBeVisible()

    expect(
        await screen.findByText("market data bootstrap finished"),
    ).toBeVisible()

    expect(screen.getByText("sample warning")).toBeVisible()
    expect(screen.getByText("sample error")).toBeVisible()

    expect(systemLogsMocks.getSystemLogs).toHaveBeenCalled()
  })

  it("log özet sayılarını gösterir", async () => {
    render(<SystemLogsPage />)

    await screen.findByText("sample error")

    expect(screen.getByText("3")).toBeVisible()
    expect(screen.getByText("1")).toBeVisible()
  })
})