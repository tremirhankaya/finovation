import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import PriceTrendChart from "@/features/fund-monitoring/components/PriceTrendChart"

const POINTS = [
  { date: "2026-01-01", value: 10 },
  { date: "2026-01-02", value: 11 },
  { date: "2026-01-03", value: 12 },
]

describe("PriceTrendChart", () => {
  it("sol fiyat ve alt tarih eksenlerini gösterir", () => {
    render(
      <PriceTrendChart points={POINTS} fundName="Atlas Fonu" currency="TRY" />,
    )

    expect(screen.getByText("01 Oca")).toBeInTheDocument()
    expect(screen.getByText("03 Oca")).toBeInTheDocument()
    expect(screen.getByText("12,00")).toBeInTheDocument()
  })

  it("mouse konumuna en yakın günün tarih ve pay fiyatını gösterir", () => {
    render(
      <PriceTrendChart points={POINTS} fundName="Atlas Fonu" currency="TRY" />,
    )

    const chart = screen.getByRole("img", {
      name: "Atlas Fonu pay fiyatı değişim grafiği",
    })
    Object.defineProperty(chart, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 0,
        left: 0,
        right: 760,
        bottom: 250,
        width: 760,
        height: 250,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    })

    fireEvent.pointerMove(chart, { clientX: 407, clientY: 100 })

    const tooltip = screen.getByRole("status")
    expect(tooltip).toHaveTextContent("02 Ocak 2026")
    expect(tooltip).toHaveTextContent("Pay fiyatı: ₺11,0000")

    fireEvent.pointerLeave(chart)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
