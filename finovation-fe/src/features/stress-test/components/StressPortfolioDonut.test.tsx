import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import StressPortfolioDonut from "@/features/stress-test/components/StressPortfolioDonut"

const ASSETS = [
    {
        assetCode: "AKBNK.E",
        assetType: "EQUITY" as const,
        weight: 20,
        impact: -0.08,
        portfolioContribution: -0.016,
    },
    {
        assetCode: "TPP1G",
        assetType: "TPP" as const,
        weight: 10,
        impact: 0.002,
        portfolioContribution: 0.0002,
    },
]

describe("StressPortfolioDonut", () => {
    it("portföy dağılımını gösterir", () => {
        render(<StressPortfolioDonut assets={ASSETS} />)

        expect(screen.getByText("AKBNK.E")).toBeInTheDocument()
        expect(screen.getByText("20.00%")).toBeInTheDocument()
        expect(screen.getByText("TPP1G")).toBeInTheDocument()
        expect(screen.getByText("10.00%")).toBeInTheDocument()
        expect(screen.getByText("2")).toBeInTheDocument()
    })

    it("asset yoksa grafik oluşturmaz", () => {
        const { container } = render(
            <StressPortfolioDonut assets={[]} />,
        )

        expect(container).toBeEmptyDOMElement()
    })
})