import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import DualRangeSlider from "@/features/optimization/components/DualRangeSlider"

describe("DualRangeSlider", () => {
  it("min ve maks değerlerini metin alanlarında gösterir", () => {
    render(
      <DualRangeSlider
        id="stock-count"
        min={16}
        max={30}
        valueMin={16}
        valueMax={30}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole("textbox", { name: "Minimum" })).toHaveValue("16")
    expect(screen.getByRole("textbox", { name: "Maksimum" })).toHaveValue("30")
  })

  it("alt sınırları gösterir", () => {
    render(
      <DualRangeSlider
        id="tpp"
        min={5}
        max={15}
        valueMin={5}
        valueMax={15}
        inputPrefix="%"
        formatBound={(value) => `%${value}`}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText("%5")).toBeInTheDocument()
    expect(screen.getByText("%15")).toBeInTheDocument()
  })

  it("minimum kaydırıcı sürüklenince onChange'i yeni min ile çağırır", () => {
    const onChange = vi.fn()

    render(
      <DualRangeSlider
        id="stock-count"
        min={16}
        max={30}
        valueMin={16}
        valueMax={30}
        minGap={5}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByRole("slider", { name: "Minimum kaydırıcı" }), {
      target: { value: "20" },
    })

    expect(onChange).toHaveBeenCalledWith({ min: 20, max: 30 })
  })

  it("maksimum kaydırıcı minimum boşluğun altına inince minimumu da öteler", () => {
    const onChange = vi.fn()

    render(
      <DualRangeSlider
        id="stock-count"
        min={16}
        max={30}
        valueMin={20}
        valueMax={25}
        minGap={5}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByRole("slider", { name: "Maksimum kaydırıcı" }), {
      target: { value: "22" },
    })

    expect(onChange).toHaveBeenCalledWith({ min: 17, max: 22 })
  })

  it("maksimum tutamaç varsayılan olarak minimumun önündedir", () => {
    render(
      <DualRangeSlider
        id="tpp"
        min={5}
        max={15}
        valueMin={6}
        valueMax={9}
        onChange={vi.fn()}
      />,
    )

    const minSlider = screen.getByRole("slider", { name: "Minimum kaydırıcı" })
    const maxSlider = screen.getByRole("slider", { name: "Maksimum kaydırıcı" })

    expect(maxSlider).toHaveStyle({ zIndex: "4" })
    expect(minSlider).toHaveStyle({ zIndex: "3" })
  })

  it("minimum tavana yaklaşınca minimum öne geçer", () => {
    render(
      <DualRangeSlider
        id="tpp"
        min={5}
        max={15}
        valueMin={14.5}
        valueMax={15}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("slider", { name: "Minimum kaydırıcı" }),
    ).toHaveStyle({ zIndex: "5" })
  })

  it("verilen özel ipucu metnini gösterir", () => {
    render(
      <DualRangeSlider
        id="tpp"
        min={5}
        max={15}
        valueMin={5}
        valueMax={15}
        hint="İzahname: TPP ağırlığı %5 ile %15 arasında"
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText("İzahname: TPP ağırlığı %5 ile %15 arasında"),
    ).toBeInTheDocument()
  })

  it("minimum alanına yazıp onaylayınca (blur) onChange'i çağırır", () => {
    const onChange = vi.fn()

    render(
      <DualRangeSlider
        id="stock-count"
        min={16}
        max={30}
        valueMin={16}
        valueMax={30}
        minGap={5}
        onChange={onChange}
      />,
    )

    const minInput = screen.getByRole("textbox", { name: "Minimum" })
    fireEvent.change(minInput, { target: { value: "18" } })
    fireEvent.blur(minInput)

    expect(onChange).toHaveBeenCalledWith({ min: 18, max: 30 })
  })

  it("geçersiz minimum değeri onaylanınca eski değere döner", () => {
    const onChange = vi.fn()

    render(
      <DualRangeSlider
        id="stock-count"
        min={16}
        max={30}
        valueMin={16}
        valueMax={30}
        minGap={5}
        onChange={onChange}
      />,
    )

    const minInput = screen.getByRole("textbox", { name: "Minimum" })
    fireEvent.change(minInput, { target: { value: "100" } })
    fireEvent.blur(minInput)

    expect(onChange).not.toHaveBeenCalled()
    expect(minInput).toHaveValue("16")
  })
})
