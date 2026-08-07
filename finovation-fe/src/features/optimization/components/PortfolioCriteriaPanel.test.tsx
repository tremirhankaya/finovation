import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import PortfolioCriteriaPanel from "@/features/optimization/components/PortfolioCriteriaPanel"
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
    assetCode: "BIMAS",
    name: "BİM",
    sectorName: "Perakende Ticaret",
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

describe("PortfolioCriteriaPanel", () => {
  it("özet sayıları gösterir", () => {
    render(
      <PortfolioCriteriaPanel
        assets={ASSETS}
        summary={{
          increasedCount: 1,
          decreasedCount: 0,
          keptCount: 1,
          overriddenCount: 0,
        }}
      />,
    )

    expect(
      screen.getByText(
        (_, element) => element?.textContent === "1 hisse artırıldı",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "0 hisse azaltıldı",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "1 hisse korundu",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "0 hisse manuel değiştirildi",
      ),
    ).toBeInTheDocument()
  })

  it("yalnızca gerekçesi olan hisseleri listeler", () => {
    render(
      <PortfolioCriteriaPanel
        assets={ASSETS}
        summary={{
          increasedCount: 1,
          decreasedCount: 0,
          keptCount: 1,
          overriddenCount: 0,
        }}
      />,
    )

    expect(screen.getByText("Güçlü kazanç büyümesi.")).toBeInTheDocument()
    expect(screen.getAllByText("AKBNK")).toHaveLength(1)
    expect(screen.queryByText("BIMAS")).not.toBeInTheDocument()
  })
})
