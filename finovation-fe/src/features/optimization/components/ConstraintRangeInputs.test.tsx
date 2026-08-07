import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ConstraintRangeInputs from "@/features/optimization/components/ConstraintRangeInputs"

describe("ConstraintRangeInputs", () => {
  it("min ve maksimum değerleri, alt/üst sınırlarla birlikte gösterir", () => {
    render(
      <ConstraintRangeInputs
        label="TPP Ağırlık Aralığı (%)"
        min={5}
        max={15}
        floor={5}
        ceiling={15}
        minWidth={3}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
        hint="İzahname: TPP ağırlığı %5 ile %15 arasında"
      />,
    )

    expect(screen.getByText("TPP Ağırlık Aralığı (%)")).toBeInTheDocument()
    expect(screen.getByText("Min 5 — Maks 15")).toBeInTheDocument()
    expect(
      screen.getByRole("spinbutton", {
        name: "TPP Ağırlık Aralığı (%) minimum",
      }),
    ).toHaveValue(5)
    expect(
      screen.getByRole("spinbutton", {
        name: "TPP Ağırlık Aralığı (%) maksimum",
      }),
    ).toHaveValue(15)
    expect(
      screen.getByText("İzahname: TPP ağırlığı %5 ile %15 arasında"),
    ).toBeInTheDocument()
  })

  it("minimum değer değiştiğinde onMinChange'i sayısal değerle çağırır", () => {
    const onMinChange = vi.fn()

    render(
      <ConstraintRangeInputs
        label="Hisse Sayısı Aralığı"
        min={16}
        max={30}
        floor={16}
        ceiling={30}
        minWidth={5}
        onMinChange={onMinChange}
        onMaxChange={vi.fn()}
        hint="Sistem sınırı: 16 ≤ hisse sayısı ≤ 30"
      />,
    )

    const minInput = screen.getByRole("spinbutton", {
      name: "Hisse Sayısı Aralığı minimum",
    })
    fireEvent.change(minInput, { target: { value: "20" } })

    expect(onMinChange).toHaveBeenLastCalledWith(20)
  })

  it("maksimum değer değiştiğinde onMaxChange'i sayısal değerle çağırır", () => {
    const onMaxChange = vi.fn()

    render(
      <ConstraintRangeInputs
        label="Hisse Sayısı Aralığı"
        min={16}
        max={25}
        floor={16}
        ceiling={30}
        minWidth={5}
        onMinChange={vi.fn()}
        onMaxChange={onMaxChange}
        hint="Sistem sınırı: 16 ≤ hisse sayısı ≤ 30"
      />,
    )

    const maxInput = screen.getByRole("spinbutton", {
      name: "Hisse Sayısı Aralığı maksimum",
    })
    fireEvent.change(maxInput, { target: { value: "30" } })

    expect(onMaxChange).toHaveBeenLastCalledWith(30)
  })

  it("min ve maks kaydırıcıları da render eder", () => {
    render(
      <ConstraintRangeInputs
        label="TPP Ağırlık Aralığı (%)"
        min={5}
        max={15}
        floor={5}
        ceiling={15}
        minWidth={3}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
        hint="İzahname: TPP ağırlığı %5 ile %15 arasında"
      />,
    )

    expect(
      screen.getByRole("slider", {
        name: "TPP Ağırlık Aralığı (%) minimum kaydırıcı",
      }),
    ).toHaveValue("5")
    expect(
      screen.getByRole("slider", {
        name: "TPP Ağırlık Aralığı (%) maksimum kaydırıcı",
      }),
    ).toHaveValue("15")
  })

  it("kaydırıcı ile aralığı minWidth'in altına daraltamaz", () => {
    const onMinChange = vi.fn()

    render(
      <ConstraintRangeInputs
        label="TPP Ağırlık Aralığı (%)"
        min={6}
        max={9}
        floor={5}
        ceiling={15}
        minWidth={3}
        onMinChange={onMinChange}
        onMaxChange={vi.fn()}
        hint="İzahname: TPP ağırlığı %5 ile %15 arasında · aralık genişliği en az 3 puan"
      />,
    )

    const minSlider = screen.getByRole("slider", {
      name: "TPP Ağırlık Aralığı (%) minimum kaydırıcı",
    })
    fireEvent.change(minSlider, { target: { value: "8" } })

    expect(onMinChange).toHaveBeenLastCalledWith(6)
  })
})
