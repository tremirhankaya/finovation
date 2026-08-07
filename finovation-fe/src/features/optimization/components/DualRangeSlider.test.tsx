import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import DualRangeSlider from "@/features/optimization/components/DualRangeSlider"

describe("DualRangeSlider", () => {
  it("uç noktalardaki değer baloncuklarını gösterir", () => {
    render(
      <DualRangeSlider
        label="Hisse Sayısı Aralığı"
        min={16}
        max={35}
        floor={16}
        ceiling={35}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText("16")).toHaveLength(2)
    expect(screen.getAllByText("35")).toHaveLength(2)
  })

  it("ara tik değerlerini eşit aralıklarla hesaplayıp gösterir", () => {
    render(
      <DualRangeSlider
        label="TPP Ağırlık Aralığı (%)"
        min={5}
        max={15}
        floor={5}
        ceiling={15}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
      />,
    )

    expect(screen.getByText("7.5")).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("12.5")).toBeInTheDocument()
  })

  it("minimum kaydırıcı maksimumu geçemez", () => {
    const onMinChange = vi.fn()

    render(
      <DualRangeSlider
        label="Hisse Sayısı Aralığı"
        min={16}
        max={20}
        floor={16}
        ceiling={35}
        onMinChange={onMinChange}
        onMaxChange={vi.fn()}
      />,
    )

    const minSlider = screen.getByRole("slider", {
      name: "Hisse Sayısı Aralığı minimum kaydırıcı",
    })
    fireEvent.change(minSlider, { target: { value: "34" } })

    expect(onMinChange).toHaveBeenCalledWith(19)
  })

  it("maksimum kaydırıcı minimumun altına inemez", () => {
    const onMaxChange = vi.fn()

    render(
      <DualRangeSlider
        label="Hisse Sayısı Aralığı"
        min={30}
        max={35}
        floor={16}
        ceiling={35}
        onMinChange={vi.fn()}
        onMaxChange={onMaxChange}
      />,
    )

    const maxSlider = screen.getByRole("slider", {
      name: "Hisse Sayısı Aralığı maksimum kaydırıcı",
    })
    fireEvent.change(maxSlider, { target: { value: "17" } })

    expect(onMaxChange).toHaveBeenCalledWith(31)
  })

  it("tutamaçlar yakınlaştığında az önce basılan tutamacı öne getirir", () => {
    render(
      <DualRangeSlider
        label="TPP Ağırlık Aralığı (%)"
        min={6}
        max={9}
        floor={5}
        ceiling={15}
        onMinChange={vi.fn()}
        onMaxChange={vi.fn()}
      />,
    )

    const minSlider = screen.getByRole("slider", {
      name: "TPP Ağırlık Aralığı (%) minimum kaydırıcı",
    })
    const maxSlider = screen.getByRole("slider", {
      name: "TPP Ağırlık Aralığı (%) maksimum kaydırıcı",
    })

    fireEvent.pointerDown(minSlider)
    expect(minSlider).toHaveStyle({ zIndex: "3" })
    expect(maxSlider).toHaveStyle({ zIndex: "1" })

    fireEvent.pointerDown(maxSlider)
    expect(maxSlider).toHaveStyle({ zIndex: "3" })
    expect(minSlider).toHaveStyle({ zIndex: "2" })
  })
})
