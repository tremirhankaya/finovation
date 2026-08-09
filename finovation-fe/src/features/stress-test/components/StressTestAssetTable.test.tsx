import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import StressTestAssetTable from "@/features/stress-test/components/StressTestAssetTable"

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

describe("StressTestAssetTable", () => {
    it("stres testi varlık sonuçlarını doğru formatta gösterir", () => {
        render(<StressTestAssetTable assets={ASSETS} />)

        expect(screen.getByText("AKBNK.E")).toBeInTheDocument()
        expect(screen.getByText("TPP1G")).toBeInTheDocument()

        expect(screen.getByText("8.00%")).toBeInTheDocument()
        expect(screen.getByText("19.00%")).toBeInTheDocument()

        expect(screen.getByText("-8.40%")).toBeInTheDocument()
        expect(screen.getByText("+0.20%")).toBeInTheDocument()

        expect(screen.getByText("-0.67%")).toBeInTheDocument()
        expect(screen.getByText("+0.04%")).toBeInTheDocument()
    })

    it("asset sonucu yoksa empty state gösterir", () => {
        render(<StressTestAssetTable assets={[]} />)

        expect(
            screen.getByText(
                "Bu stres testi için varlık sonucu bulunmuyor.",
            ),
        ).toBeInTheDocument()
    })
})