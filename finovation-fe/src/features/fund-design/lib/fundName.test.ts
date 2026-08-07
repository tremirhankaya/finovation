import { describe, expect, it } from "vitest"

import {
  FUND_NAME_MIN_LETTERS,
  isFundNameReady,
  validateFundName,
} from "@/features/fund-design/lib/fundName"

describe("fundName", () => {
  it("rejects empty and whitespace", () => {
    expect(validateFundName("")).toBe("Fon adı zorunludur.")
    expect(validateFundName("   ")).toBe("Fon adı zorunludur.")
    expect(isFundNameReady("")).toBe(false)
  })

  it("rejects names that contain digits", () => {
    expect(validateFundName("Fon 2")).toBe("Fon adında sayı bulunamaz.")
    expect(validateFundName("ABCDE1")).toBe("Fon adında sayı bulunamaz.")
  })

  it(`requires at least ${FUND_NAME_MIN_LETTERS} letters`, () => {
    expect(validateFundName("Fon")).toBe(
      `Fon adı en az ${FUND_NAME_MIN_LETTERS} harf içermelidir.`,
    )
    expect(validateFundName("Fon A")).toBe(
      `Fon adı en az ${FUND_NAME_MIN_LETTERS} harf içermelidir.`,
    )
    expect(isFundNameReady("Fonab")).toBe(true)
  })

  it("accepts Turkish letters without digits", () => {
    expect(validateFundName("Finovation Hisse Senedi Fonu")).toBeNull()
    expect(isFundNameReady("Örnek Fon Adı")).toBe(true)
  })
})
