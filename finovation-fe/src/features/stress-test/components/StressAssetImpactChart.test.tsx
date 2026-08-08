import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import StressAssetImpactChart from "@/features/stress-test/components/StressAssetImpactChart"

const ASSETS = [
    {
        assetCode: "AKBNK.E",
        assetType: "EQUITY" as const,
        weight: 8,
        impact: -0.084,
        portfolioContribution: -0.00672,
    },
    {
        assetCode: "TPP1G",
        assetType: "TPP" as const,
        weight: 19,
        impact: 0.002,
        portfolioContribution: 0.00038,
    },
]

describe("StressAssetImpactChart", () => {
    it("varlıkların senaryodan etkilenme oranlarını gösterir", () => {
        render(<StressAssetImpactChart assets={ASSETS} />)

        expect(screen.getByText("AKBNK.E")).toBeInTheDocument()
        expect(screen.getByText("TPP1G")).toBeInTheDocument()

        expect(screen.getByText("-8.40%")).toBeInTheDocument()
        expect(screen.getByText("+0.20%")).toBeInTheDocument()
    })

    it("asset listesi boşsa grafik oluşturmaz", () => {
        const { container } = render(
            <StressAssetImpactChart assets={[]} />,
        )

        expect(container).toBeEmptyDOMElement()
    })
})