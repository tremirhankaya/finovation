import { describe, expect, it } from "vitest"

import {
    formatStressDate,
    formatStressPercentage,
    formatStressWeight,
} from "@/features/stress-test/lib/stressTestFormatters"

describe("stressTestFormatters", () => {
    it("oran değerini kullanıcıya yüzde olarak gösterir", () => {
        expect(formatStressPercentage(-0.042)).toBe("-4.20%")
        expect(formatStressPercentage(0.0125)).toBe("+1.25%")
        expect(formatStressPercentage(0)).toBe("0.00%")
    })

    it("ISO tarihi Türkçe ekran formatına dönüştürür", () => {
        expect(formatStressDate("2026-08-07")).toBe("07.08.2026")
    })

    it("beklenmeyen tarih değerini bozmadan döndürür", () => {
        expect(formatStressDate("unknown")).toBe("unknown")
    })
    it("portföy ağırlığını doğrudan yüzde formatında gösterir", () => {
        expect(formatStressWeight(8)).toBe("8.00%")
        expect(formatStressWeight(19)).toBe("19.00%")
    })
})