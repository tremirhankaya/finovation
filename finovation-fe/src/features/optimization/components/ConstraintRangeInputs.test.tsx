import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ConstraintRangeInputs from "@/features/optimization/components/ConstraintRangeInputs"

describe("ConstraintRangeInputs", () => {
  it("etiketi, alt/üst sınırları ve ipucunu gösterir", () => {
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
      screen.getByText("İzahname: TPP ağırlığı %5 ile %15 arasında"),
    ).toBeInTheDocument()
  })

  it("min ve maks değerlerini metin alanlarında gösterir", () => {
    render(
      <ConstraintRangeInputs
        label="Hisse Sayısı Aralığı"
        min={16}
        max={30}
        floor={16}
        ceiling={30}
        minWidth={5}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
        hint="Sistem sınırı: 16 ≤ hisse sayısı ≤ 30"
      />,
    )

    expect(
      screen.getByRole("textbox", { name: "Hisse Sayısı Aralığı Minimum" }),
    ).toHaveValue("16")
    expect(
      screen.getByRole("textbox", { name: "Hisse Sayısı Aralığı Maksimum" }),
    ).toHaveValue("30")
  })

  it("minimum kaydırıcı değişince onMinChange'i sayısal değerle çağırır", () => {
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

    fireEvent.change(
      screen.getByRole("slider", {
        name: "Hisse Sayısı Aralığı Minimum kaydırıcı",
      }),
      { target: { value: "20" } },
    )

    expect(onMinChange).toHaveBeenLastCalledWith(20)
  })

  it("maksimum kaydırıcı değişince onMaxChange'i sayısal değerle çağırır", () => {
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

    fireEvent.change(
      screen.getByRole("slider", {
        name: "Hisse Sayısı Aralığı Maksimum kaydırıcı",
      }),
      { target: { value: "30" } },
    )

    expect(onMaxChange).toHaveBeenLastCalledWith(30)
  })

  it("kaydırıcı minWidth'i ihlal edecek şekilde sürüklenince diğer ucu öteler", () => {
    const onMinChange = vi.fn()
    const onMaxChange = vi.fn()

    render(
      <ConstraintRangeInputs
        label="TPP Ağırlık Aralığı (%)"
        min={6}
        max={9}
        floor={5}
        ceiling={15}
        minWidth={3}
        onMinChange={onMinChange}
        onMaxChange={onMaxChange}
        hint="İzahname: TPP ağırlığı %5 ile %15 arasında · aralık genişliği en az 3 puan"
      />,
    )

    fireEvent.change(
      screen.getByRole("slider", {
        name: "TPP Ağırlık Aralığı (%) Minimum kaydırıcı",
      }),
      { target: { value: "8" } },
    )

    expect(onMinChange).toHaveBeenLastCalledWith(8)
    expect(onMaxChange).toHaveBeenLastCalledWith(11)
  })
})
