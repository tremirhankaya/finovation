import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import ComplianceSummaryPanel from "@/features/optimization/components/ComplianceSummaryPanel"
import type { ComplianceRow } from "@/features/optimization/model/optimizationForm.types"

const ROWS: ComplianceRow[] = [
  {
    key: "tpp-range",
    label: "TPP aralığı",
    status: "UYUMLU",
    detail: "%5–%15 aralığında",
  },
  {
    key: "stock-count",
    label: "Hisse sayısı",
    status: "UYUMSUZ",
    detail: "Sistem sınırı 16–30 arasında",
  },
]

describe("ComplianceSummaryPanel", () => {
  it("her satırı etiket, durum rozeti ve detayıyla listeler", () => {
    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={vi.fn()}
        canSubmit={false}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText("TPP aralığı")).toBeInTheDocument()
    expect(screen.getByText("%5–%15 aralığında")).toBeInTheDocument()
    expect(screen.getByText("Hisse sayısı")).toBeInTheDocument()
    expect(screen.getByText("Sistem sınırı 16–30 arasında")).toBeInTheDocument()
  })

  it("canSubmit false iken gönder butonunu devre dışı bırakır", () => {
    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={vi.fn()}
        canSubmit={false}
        isSubmitting={false}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    ).toBeDisabled()
  })

  it("isSubmitting true iken buton metnini değiştirir", () => {
    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={vi.fn()}
        canSubmit={true}
        isSubmitting={true}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Gönderiliyor…" }),
    ).toBeInTheDocument()
  })

  it("gönder butonuna tıklanınca onSubmit'i çağırır", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={onSubmit}
        canSubmit={true}
        isSubmitting={false}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Optimizasyonu Çalıştır" }),
    )

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
