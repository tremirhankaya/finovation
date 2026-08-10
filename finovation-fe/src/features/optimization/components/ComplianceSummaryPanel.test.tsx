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
  it("başlığı ve her satırı etiket ile detayıyla listeler", () => {
    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={vi.fn()}
        canSubmit={false}
        isSubmitting={false}
      />,
    )

    expect(
      screen.getByText("İzahname ve Kural Kontrolü"),
    ).toBeInTheDocument()
    expect(screen.getByText("TPP aralığı")).toBeInTheDocument()
    expect(screen.getByText("%5–%15 aralığında")).toBeInTheDocument()
    expect(screen.getByText("Hisse sayısı")).toBeInTheDocument()
    expect(screen.getByText("Sistem sınırı 16–30 arasında")).toBeInTheDocument()
  })

  it("Durum lejantını ve izahname dipnotunu gösterir", () => {
    render(
      <ComplianceSummaryPanel
        rows={ROWS}
        onSubmit={vi.fn()}
        canSubmit={false}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText("Durum")).toBeInTheDocument()
    expect(
      screen.getByText("Yeşil: Kendi Kriterinize ve İzahnameye Uygun"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Turuncu: Yalnızca İzahnameye Uygun"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Kırmızı: İzahnameye Uygun Değil"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Gri: Bilgi / Kısıt (Değiştirilemez)"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Kısıtlar fon izahnamesine göre kontrol edilmektedir."),
    ).toBeInTheDocument()
  })

  it("kilitli bir satırda Kısıt (Değiştirilemez) etiketini gösterir", () => {
    render(
      <ComplianceSummaryPanel
        rows={[
          {
            key: "forced-excluded-assets",
            label: "Zorunlu ve Hariç Tutulan Hisseler",
            status: "UYUMLU",
            locked: true,
            detail: "0 hisse zorunlu eklenecek",
          },
        ]}
        onSubmit={vi.fn()}
        canSubmit={false}
        isSubmitting={false}
      />,
    )

    expect(screen.getByText("Kısıt (Değiştirilemez)")).toBeInTheDocument()
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
