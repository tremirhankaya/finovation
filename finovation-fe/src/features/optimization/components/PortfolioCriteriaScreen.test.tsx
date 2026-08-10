import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import PortfolioCriteriaScreen from "@/features/optimization/components/PortfolioCriteriaScreen"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

function asset(
  overrides: Partial<OptimizationResultAsset> & { assetCode: string },
): OptimizationResultAsset {
  return {
    name: overrides.assetCode,
    sectorName: null,
    assetType: "EQUITY",
    currentWeight: 5,
    proposedWeight: 5,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    ...overrides,
  }
}

const BASE_PROPS = {
  fundName: "Finovation Atlas Fonu",
  rows: [],
  isApprovalBlocked: false,
  isSubmitting: false,
  submitErrorMessage: "",
  onExportPdf: vi.fn(),
  isExportingPdf: false,
  onExportExcel: vi.fn(),
  isExportingExcel: false,
  onEditWeights: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
}

describe("PortfolioCriteriaScreen — Model Gerekçeleri", () => {
  it("her hisse için ayrı bir kart gösterir", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "MGROS.E",
            actionType: "INCREASE",
            rationale: "MGROS gerekçesi",
          }),
          asset({
            assetCode: "TTKOM.E",
            actionType: "DECREASE",
            rationale: "TTKOM gerekçesi",
          }),
        ]}
      />,
    )

    expect(screen.getByText("MGROS.E")).toBeInTheDocument()
    expect(screen.getByText("TTKOM.E")).toBeInTheDocument()
  })

  it("gerekçe metnini varsayılan olarak gizler, butona tıklayınca gösterir", async () => {
    const user = userEvent.setup()

    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "AKBNK.E",
            actionType: "INCREASE",
            rationale: "Detaylı gerekçe metni burada",
          }),
        ]}
      />,
    )

    expect(
      screen.queryByText("Detaylı gerekçe metni burada"),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "AKBNK.E gerekçesini göster" }),
    )

    expect(
      screen.getByText("Detaylı gerekçe metni burada"),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "AKBNK.E gerekçesini gizle" }),
    )

    expect(
      screen.queryByText("Detaylı gerekçe metni burada"),
    ).not.toBeInTheDocument()
  })

  it("artan hissede yeşil, azalan hissede kırmızı, sabitte gri nokta sınıfı uygular", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({ assetCode: "UP.E", actionType: "INCREASE", rationale: "r" }),
          asset({
            assetCode: "DOWN.E",
            actionType: "DECREASE",
            rationale: "r",
          }),
          asset({ assetCode: "FLAT.E", actionType: "KEEP", rationale: "r" }),
        ]}
      />,
    )

    const upDot = screen.getByText("UP.E").querySelector("span")
    const downDot = screen.getByText("DOWN.E").querySelector("span")
    const flatDot = screen.getByText("FLAT.E").querySelector("span")

    expect(upDot?.className).toContain("rationaleDotUp")
    expect(downDot?.className).toContain("rationaleDotDown")
    expect(flatDot?.className).toContain("rationaleDotFlat")
  })

  it("rationaleAssets boşken bölümü hiç göstermez", () => {
    render(<PortfolioCriteriaScreen {...BASE_PROPS} rationaleAssets={[]} />)

    expect(screen.queryByText("Model Gerekçeleri")).not.toBeInTheDocument()
  })

  it("aynı sektördeki hisseleri yan yana kümeler, başlık eklemez", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "TTKOM.E",
            sectorName: "Telekomünikasyon",
            rationale: "r",
          }),
          asset({
            assetCode: "AKBNK.E",
            sectorName: "Bankacılık",
            rationale: "r",
          }),
          asset({
            assetCode: "GARAN.E",
            sectorName: "Bankacılık",
            rationale: "r",
          }),
        ]}
      />,
    )

    const cardNames = screen
      .getAllByText(/\.E$/)
      .map((el) => el.textContent?.trim())

    expect(cardNames).toEqual(["AKBNK.E", "GARAN.E", "TTKOM.E"])
    expect(screen.queryByText("Bankacılık")).not.toBeInTheDocument()
    expect(screen.queryByText("Telekomünikasyon")).not.toBeInTheDocument()
  })
})
