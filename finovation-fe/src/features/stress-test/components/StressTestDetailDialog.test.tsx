import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
    fetchStressTestDetail: vi.fn(),
}))

vi.mock(
    "@/features/stress-test/api/stressTestService",
    () => serviceMocks,
)

import StressTestDetailDialog from "@/features/stress-test/components/StressTestDetailDialog"

const DETAIL = {
    testId: "11111111-1111-4111-8111-111111111111",
    scenarioCode: "GLOBAL_CRISIS",
    scenarioName: "Küresel Kriz",
    asOfDate: "2026-08-07",
    portfolioImpact: -0.042,
    createdAt: "2026-08-07T16:30:15",
    assets: [
        {
            assetCode: "AKBNK.E",
            assetType: "EQUITY" as const,
            weight: 8,
            impact: -0.084,
            portfolioContribution: -0.00672,
        },
    ],
}

describe("StressTestDetailDialog", () => {
    beforeEach(() => {
        serviceMocks.fetchStressTestDetail.mockReset()
    })

    it("seçilen stres testinin detayını yükler ve gösterir", async () => {
        serviceMocks.fetchStressTestDetail.mockResolvedValue(DETAIL)

        render(
            <StressTestDetailDialog
                testId={DETAIL.testId}
                onClose={vi.fn()}
            />,
        )

        expect(
            await screen.findByText("Küresel Kriz"),
        ).toBeInTheDocument()

        expect(screen.getByText("-4.20%")).toBeInTheDocument()
        expect(screen.getByText("AKBNK.E")).toBeInTheDocument()

        expect(
            serviceMocks.fetchStressTestDetail,
        ).toHaveBeenCalledWith(
            DETAIL.testId,
            expect.any(AbortSignal),
        )
    })
})