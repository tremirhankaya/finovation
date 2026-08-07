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
]

describe("AssetComparisonPanel", () => {
  it("mevcut, önerilen ve değişim değerlerini gösterir", () => {
    render(
      <AssetComparisonPanel
        assets={ASSETS}
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    expect(screen.getByText(/AKBNK Akbank/)).toBeInTheDocument()
    expect(screen.getByText("%8")).toBeInTheDocument()
    expect(screen.getByText("%9.5")).toBeInTheDocument()
    expect(screen.getByText("+%1.5")).toBeInTheDocument()
    expect(screen.getByText("-%2")).toBeInTheDocument()
  })

  it("aksiyon rozetlerini doğru etiketle gösterir", () => {
    render(
      <AssetComparisonPanel
        assets={ASSETS}
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    expect(screen.getByText("Artır")).toBeInTheDocument()
    expect(screen.getByText("Azalt")).toBeInTheDocument()
  })

  it("manuel değiştirilmiş satırda sıfırla butonunu gösterir, diğerinde göstermez", () => {
    render(
      <AssetComparisonPanel
        assets={ASSETS}
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Manuel · Sıfırla" }),
    ).toBeInTheDocument()
  })

  it("final ağırlık kutusu değiştiğinde onFinalWeightChange'i çağırır", () => {
    const onFinalWeightChange = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
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

  it("sıfırla butonuna tıklanınca onResetFinalWeight'i doğru kodla çağırır", async () => {
    const user = userEvent.setup()
    const onResetFinalWeight = vi.fn()

    render(
      <AssetComparisonPanel
        assets={ASSETS}
        onFinalWeightChange={vi.fn()}
        onResetFinalWeight={onResetFinalWeight}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manuel · Sıfırla" }))

    expect(onResetFinalWeight).toHaveBeenCalledWith("ASELS")
  })
})
