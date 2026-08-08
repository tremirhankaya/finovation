import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
    deleteStressTest: vi.fn(),
}))

vi.mock(
    "@/features/stress-test/api/stressTestService",
    () => serviceMocks,
)

import StressTestDeleteConfirm from "@/features/stress-test/components/StressTestDeleteConfirm"

const TEST_ID = "11111111-1111-4111-8111-111111111111"

describe("StressTestDeleteConfirm", () => {
    beforeEach(() => {
        serviceMocks.deleteStressTest.mockReset()
    })

    it("onaylandığında testi siler ve parent'ı bilgilendirir", async () => {
        const user = userEvent.setup()
        const onDeleted = vi.fn()
        const onClose = vi.fn()

        serviceMocks.deleteStressTest.mockResolvedValue(undefined)

        render(
            <StressTestDeleteConfirm
                testId={TEST_ID}
                onClose={onClose}
                onDeleted={onDeleted}
            />,
        )

        await user.click(
            screen.getByRole("button", { name: "Sil" }),
        )

        expect(serviceMocks.deleteStressTest).toHaveBeenCalledWith(TEST_ID)
        expect(onDeleted).toHaveBeenCalledWith(TEST_ID)
        expect(onClose).toHaveBeenCalledOnce()
    })
})