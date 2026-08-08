import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    apiSend: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
    fetchStressScenarios,
    fetchStressTestFunds,
} from "@/features/stress-test/api/stressTestService"

const FUND_ID = "11111111-1111-4111-8111-111111111111"

describe("stressTestService", () => {
    beforeEach(() => {
        httpMocks.apiFetch.mockReset()
        httpMocks.apiSend.mockReset()
    })

    it("stres testi için fon listesini runtime şemasıyla doğrular", async () => {
        const response = [
            {
                id: FUND_ID,
                name: "Finovation Hisse Fonu",
                type: "EQUITY_INTENSIVE",
                currency: "TRY",
                inceptionDate: "2026-08-01",
            },
        ]

        httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
            Promise.resolve(parse(response)),
        )

        await expect(fetchStressTestFunds()).resolves.toEqual([
            {
                id: FUND_ID,
                name: "Finovation Hisse Fonu",
                type: "EQUITY_INTENSIVE",
            },
        ])

        expect(httpMocks.apiFetch).toHaveBeenCalledWith(
            "/api/v1/funds",
            expect.objectContaining({
                errorMessage: "Fonlar yüklenemedi",
            }),
            expect.any(Function),
        )
    })

    it("aktif stres senaryolarını backend response contractına göre doğrular", async () => {
        const response = [
            {
                code: "GLOBAL_CRISIS",
                name: "Küresel Kriz",
                description: "Küresel piyasalarda sert riskten kaçış yaşanır.",
            },
        ]

        httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
            Promise.resolve(parse(response)),
        )

        await expect(fetchStressScenarios()).resolves.toEqual(response)

        expect(httpMocks.apiFetch).toHaveBeenCalledWith(
            "/api/v1/stress-scenarios",
            expect.objectContaining({
                errorMessage: "Stres senaryoları yüklenemedi",
            }),
            expect.any(Function),
        )
    })
})