import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import StressTestResultSummary from "@/features/stress-test/components/StressTestResultSummary"

const RESULT = {
    testId: "11111111-1111-4111-8111-111111111111",
    scenarioCode: "GLOBAL_CRISIS",
    scenarioName: "Küresel Kriz",
    asOfDate: "2026-08-07",
    portfolioImpact: -0.042,
    assets: [
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
    ],
}

describe("StressTestResultSummary", () => {
    it("stres testi sonucunun temel KPI değerlerini gösterir", () => {
        render(<StressTestResultSummary result={RESULT} />)

        expect(
            screen.getByRole("heading", { name: "Küresel Kriz" }),
        ).toBeInTheDocument()

        expect(screen.getByText("-4.20%")).toBeInTheDocument()
        expect(screen.getByText("07.08.2026")).toBeInTheDocument()
        expect(screen.getByText("2")).toBeInTheDocument()
        expect(screen.getByText("Negatif etki")).toBeInTheDocument()
    })
})