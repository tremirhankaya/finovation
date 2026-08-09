import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import StressContributionChart from "@/features/stress-test/components/StressContributionChart"

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

describe("StressContributionChart", () => {
    it("varlıkların portföy katkılarını gösterir", () => {
        render(<StressContributionChart assets={ASSETS} />)

        expect(screen.getByText("AKBNK.E")).toBeInTheDocument()
        expect(screen.getByText("TPP1G")).toBeInTheDocument()

        expect(screen.getByText("-0.67%")).toBeInTheDocument()
        expect(screen.getByText("+0.04%")).toBeInTheDocument()
    })

    it("asset listesi boşsa grafik oluşturmaz", () => {
        const { container } = render(
            <StressContributionChart assets={[]} />,
        )

        expect(container).toBeEmptyDOMElement()
    })
})