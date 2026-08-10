import { render, screen, within } from "@testing-library/react"
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
  {
    assetId: "TPP1G",
    symbol: "TPP1G",
    name: "TPP Fonu",
    sectorName: null,
    weightPercentage: 10,
  },
]

describe("KeptAssetsPanel", () => {
  it("pozisyon yoksa boş durum mesajı gösterir", () => {
    render(
      <KeptAssetsPanel
        positions={[]}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
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
        excludedAssetIds={new Set()}
        keptWeightSum={7}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    const table = within(screen.getByRole("table"))
    expect(table.getByText("AKBNK")).toBeInTheDocument()
    expect(table.getByText("Akbank")).toBeInTheDocument()
    expect(table.getByText("Bankacılık")).toBeInTheDocument()
    expect(table.getByText("%8")).toBeInTheDocument()
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
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={onToggle}
        onToggleExclude={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", { name: "AKBNK hissesini koru" }),
    )

    expect(onToggle).toHaveBeenCalledWith("AKBNK")
  })

  it("çıkar işaretini tıklayınca onToggleExclude'ı doğru hisse koduyla çağırır", async () => {
    const user = userEvent.setup()
    const onToggleExclude = vi.fn()

    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={onToggleExclude}
      />,
    )

    await user.click(
      screen.getByRole("checkbox", { name: "AKBNK hissesini çıkar" }),
    )

    expect(onToggleExclude).toHaveBeenCalledWith("AKBNK")
  })

  it("TPP1G bir hisse olmadığı için listede hiç gösterilmez", () => {
    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    expect(screen.queryByText("TPP1G")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", { name: "TPP1G hissesini koru" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("checkbox", { name: "TPP1G hissesini çıkar" }),
    ).not.toBeInTheDocument()
  })

  it("sadece TPP1G varsa boş durum mesajı gösterir", () => {
    render(
      <KeptAssetsPanel
        positions={[
          {
            assetId: "TPP1G",
            symbol: "TPP1G",
            name: "TPP Fonu",
            sectorName: null,
            weightPercentage: 10,
          },
        ]}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Fonun mevcut pozisyon verisi bulunamadı."),
    ).toBeInTheDocument()
  })

  it("keepAtLimit true iken sadece işaretsiz koru kutularını devre dışı bırakır", () => {
    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set(["ASELS"])}
        excludedAssetIds={new Set()}
        keptWeightSum={7}
        keepAtLimit
        excludeAtLimit={false}
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "AKBNK hissesini koru" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("checkbox", { name: "ASELS hissesini koru" }),
    ).toBeEnabled()
  })

  it("excludeAtLimit true iken sadece işaretsiz çıkar kutularını devre dışı bırakır", () => {
    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set(["ASELS"])}
        keptWeightSum={0}
        keepAtLimit={false}
        excludeAtLimit
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "AKBNK hissesini çıkar" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("checkbox", { name: "ASELS hissesini çıkar" }),
    ).toBeEnabled()
  })

  it("sınıra ulaşıldığında pasif kutucuklara açıklayıcı title ekler, ekranı kaplayan bir uyarı göstermez", () => {
    render(
      <KeptAssetsPanel
        positions={POSITIONS}
        keptAssetCodes={new Set()}
        excludedAssetIds={new Set()}
        keptWeightSum={0}
        keepAtLimit
        excludeAtLimit
        onToggle={vi.fn()}
        onToggleExclude={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("checkbox", { name: "AKBNK hissesini koru" }),
    ).toHaveAttribute("title", "En fazla 3 hisse korunabilir")
    expect(
      screen.getByRole("checkbox", { name: "AKBNK hissesini çıkar" }),
    ).toHaveAttribute("title", "En fazla 3 hisse çıkarılabilir")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
