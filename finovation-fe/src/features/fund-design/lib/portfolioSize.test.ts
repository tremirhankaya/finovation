import { describe, expect, it } from "vitest"

import {
  isPortfolioSizeReady,
  limitBarPosition,
  parsePortfolioSize,
} from "@/features/fund-design/lib/portfolioSize"

const LIMITS = {
  minInitialPortfolioSize: 1_000_000,
  maxInitialPortfolioSize: 100_000_000_000,
}

describe("portfolioSize", () => {
  it("yazıdaki tutarı sayıya çevirir", () => {
    expect(parsePortfolioSize("100.000.000")).toBe(100_000_000)
  })

  it("limit yokken veya boş değerde butonu kapalı tutar", () => {
    expect(isPortfolioSizeReady("100.000.000", null)).toBe(false)
    expect(isPortfolioSizeReady("", LIMITS)).toBe(false)
    expect(isPortfolioSizeReady("0", LIMITS)).toBe(false)
  })

  it("backend limitinin dışını istek atmadan reddeder", () => {
    expect(isPortfolioSizeReady("2", LIMITS)).toBe(false)
    expect(isPortfolioSizeReady("999999", LIMITS)).toBe(false)
    expect(isPortfolioSizeReady("100000000001", LIMITS)).toBe(false)
  })

  it("backend limitindeki tutarı kabul eder", () => {
    expect(isPortfolioSizeReady("1.000.000", LIMITS)).toBe(true)
    expect(isPortfolioSizeReady("100.000.000", LIMITS)).toBe(true)
  })

  it("limit barında boş değeri işaretlemez", () => {
    expect(limitBarPosition("", LIMITS)).toBeNull()
    expect(limitBarPosition("1.000.000", LIMITS)).toBe(0)
    expect(limitBarPosition("100.000.000.000", LIMITS)).toBe(1)
  })
})
