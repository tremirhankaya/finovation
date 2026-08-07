import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import KeptAssetsPanel from "@/features/optimization/components/KeptAssetsPanel"

const POSITIONS = [
  {
    assetId: "AKBNK",
    symbol: "AKBNK",
    name: "Akbank",
    sectorName: "Bankacılık",
    weightPercentage: 8,
  },
  {
    assetId: "ASELS",
    symbol: "ASELS",
    name: "Aselsan",
    sectorName: "Savunma",
    weightPercentage: 7,
  },
]

describe("KeptAssetsPanel", () => {
  it("pozisyon yoksa boş durum mesajı gösterir", () => {
    render(
      <KeptAssetsPanel
        positions={[]}
        keptAssetCodes={new Set()}
        keptWeightSum={0}
        onToggle={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Fonun mevcut pozisyon verisi bulunamadı."),
    ).toBeInTheDocument()
  })

  it("pozisyonları hisse, sektör ve ağırlıkla listeler", () => {
    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set(["ASELS"])}
        keptWeightSum={7}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText(/AKBNK Akbank/)).toBeInTheDocument()
    expect(screen.getByText("Bankacılık")).toBeInTheDocument()
    expect(screen.getByText("%8")).toBeInTheDocument()
    expect(
      screen.getByText(/1 hisse sabitlendi · toplam %7\./),
    ).toBeInTheDocument()
  })

  it("koru işaretini tıklayınca onToggle'ı doğru hisse koduyla çağırır", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set()}
        keptWeightSum={0}
        onToggle={onToggle}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", { name: "AKBNK hissesini koru" }),
    )

    expect(onToggle).toHaveBeenCalledWith("AKBNK")
  })
})
