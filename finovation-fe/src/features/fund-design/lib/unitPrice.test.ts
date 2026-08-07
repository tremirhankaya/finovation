import { describe, expect, it } from "vitest"

import {
  formatUnitPrice,
  isUnitPriceReady,
  parseUnitPrice,
} from "@/features/fund-design/lib/unitPrice"

const LIMITS = { minUnitPrice: 1, maxUnitPrice: 1000 }

describe("unitPrice", () => {
  it("parses comma decimals", () => {
    expect(parseUnitPrice("17,50")).toBe(17.5)
    expect(parseUnitPrice("1")).toBe(1)
    expect(parseUnitPrice("1000")).toBe(1000)
    expect(parseUnitPrice("")).toBeNull()
  })

  it("formats while typing without thousand separators", () => {
    expect(formatUnitPrice("17")).toBe("17")
    expect(formatUnitPrice("17,5")).toBe("17,5")
    expect(formatUnitPrice("1000")).toBe("1000")
  })

  it("checks ready against limits", () => {
    expect(isUnitPriceReady("17", LIMITS)).toBe(true)
    expect(isUnitPriceReady("0,5", LIMITS)).toBe(false)
    expect(isUnitPriceReady("1000,01", LIMITS)).toBe(false)
    expect(isUnitPriceReady("17", null)).toBe(false)
  })
})
