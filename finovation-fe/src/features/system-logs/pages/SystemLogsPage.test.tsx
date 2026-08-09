import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import SystemLogsPage from "@/features/system-logs/pages/SystemLogsPage"

describe("SystemLogsPage", () => {
  it("backend bağlantısı olmayan tasarım durumunu açıkça gösterir", () => {
    render(<SystemLogsPage />)

    expect(screen.getByRole("heading", { name: "Log İzleme" })).toBeVisible()
    expect(screen.getByText("Backend bağlantısı bekleniyor")).toBeVisible()
    expect(
      screen.getByLabelText("Terminal logları tasarım önizlemesi"),
    ).toBeVisible()
  })
})
