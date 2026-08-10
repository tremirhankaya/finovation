import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import AssetComparisonPanel from "@/features/optimization/components/AssetComparisonPanel"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

const ASSETS: OptimizationResultAsset[] = [
  {
    assetCode: "AKBNK",
    name: "Akbank",
    sectorName: "Bankacılık",
    assetType: "EQUITY",
    currentWeight: 8,
    proposedWeight: 9.5,
    finalWeight: null,
    changeAmount: 1.5,
    actionType: "INCREASE",
    manuallyOverridden: false,
    rationale: "Güçlü kazanç büyümesi.",
  },
  {
    assetCode: "ASELS",
    name: "Aselsan",
    sectorName: "Savunma",
    assetType: "EQUITY",
    currentWeight: 7,
    proposedWeight: 5,
    finalWeight: 4,
    changeAmount: -2,
    actionType: "DECREASE",
    manuallyOverridden: true,
    rationale: "Sektör yoğunlaşma limiti.",
  },
  {
    assetCode: "THYAO",
    name: "Türk Hava Yolları",
    sectorName: "Ulaştırma",
    assetType: "EQUITY",
    currentWeight: 6,
    proposedWeight: 6,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
  },
]

describe("AssetComparisonPanel", () => {
  it("mevcut, önerilen ve değişim değerlerini gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(screen.getAllByText("%8")[0]).toBeInTheDocument()
    expect(screen.getByText("+%2")).toBeInTheDocument()
    expect(screen.getByText("-%3")).toBeInTheDocument()
  })

  it("sabit tutulan hissede SABİT rozetini gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("SABİT")).toBeInTheDocument()
  })

  it("filtre çipleri ile listeyi daraltır", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(
      screen.getByRole("tab", { name: /Artırılanlar/ }),
    )

    expect(screen.getByText("AKBNK")).toBeInTheDocument()
    expect(screen.queryByText("ASELS")).not.toBeInTheDocument()
  })

  it("toplam satırını gösterir", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.getByText("TOPLAM")).toBeInTheDocument()
  })

  it("düzenlenebilir modda final ağırlık kutusu değiştiğinde onFinalWeightChange'i çağırır", () => {
    const onFinalWeightChange = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={onFinalWeightChange}
        onResetFinalWeight={vi.fn()}
      />,
    )

    const input = screen.getByRole("spinbutton", {
      name: "AKBNK final ağırlığı",
    })
    fireEvent.change(input, { target: { value: "11" } })

    expect(onFinalWeightChange).toHaveBeenCalledWith("AKBNK", 11)
  })

  it("düzenlenebilir modda sıfırla butonuna tıklanınca onResetFinalWeight'i doğru kodla çağırır", async () => {
    const user = userEvent.setup()
    const onResetFinalWeight = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        fundName="Test Fonu"
        editable
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={onResetFinalWeight}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manuel · Sıfırla" }))

    expect(onResetFinalWeight).toHaveBeenCalledWith("ASELS")
  })

  it("düzenlenebilir değilken final ağırlık salt metin olarak görünür", () => {
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  })

  it("grafik görünümüne geçince sektör tablosunu gösterir", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(screen.getByRole("button", { name: "Grafik" }))

    expect(screen.getByText("Mevcut Portföy")).toBeInTheDocument()
    expect(screen.getByText("Optimize Edilmiş Portföy")).toBeInTheDocument()
  })

  it("sektör filtresiyle sadece seçilen sektördeki hisseleri gösterir", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.selectOptions(
      screen.getByLabelText("Sektöre göre filtrele"),
      "Savunma",
    )

    expect(screen.getByText("ASELS")).toBeInTheDocument()
    expect(screen.queryByText("AKBNK")).not.toBeInTheDocument()
    expect(screen.queryByText("THYAO")).not.toBeInTheDocument()
  })

  it("Mevcut Ağırlık başlığına tıklayınca artan, tekrar tıklayınca azalan sıralar", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    const bodyRows = () => screen.getAllByRole("row").slice(1, -1)

    await user.click(
      screen.getByRole("button", { name: /Mevcut Ağırlık/ }),
    )
    let rows = bodyRows()
    expect(rows[0]?.textContent).toContain("THYAO")
    expect(rows[1]?.textContent).toContain("ASELS")
    expect(rows[2]?.textContent).toContain("AKBNK")

    await user.click(
      screen.getByRole("button", { name: /Mevcut Ağırlık/ }),
    )
    rows = bodyRows()
    expect(rows[0]?.textContent).toContain("AKBNK")
    expect(rows[1]?.textContent).toContain("ASELS")
    expect(rows[2]?.textContent).toContain("THYAO")
  })

  it("Değişim başlığına tıklayınca değişim değerine göre sıralar", async () => {
    const user = userEvent.setup()
    render(<AssetComparisonPanel assets={ASSETS} fundName="Test Fonu" />)

    await user.click(screen.getByRole("button", { name: /Değişim/ }))

    const rows = screen.getAllByRole("row").slice(1, -1)
    expect(rows[0]?.textContent).toContain("ASELS")
    expect(rows[rows.length - 1]?.textContent).toContain("AKBNK")
  })
})
