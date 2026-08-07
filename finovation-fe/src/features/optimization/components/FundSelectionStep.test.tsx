import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import FundSelectionStep from "@/features/optimization/components/FundSelectionStep"

const FUNDS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Finovation Atlas Fonu",
    type: "Hisse Senedi Yoğun Fon",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Finovation Nova Fonu",
    type: "Hisse Senedi Yoğun Fon",
  },
]

describe("FundSelectionStep", () => {
  it("yüklenirken durum bandını gösterir", () => {
    render(
      <FundSelectionStep
        funds={[]}
        selectedFundId=""
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={true}
        errorMessage=""
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent("Fonlar yükleniyor…")
  })

  it("hata mesajını gösterir", () => {
    render(
      <FundSelectionStep
        funds={[]}
        selectedFundId=""
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage="Fonlar yüklenemedi."
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Fonlar yüklenemedi.")
  })

  it("fon yoksa boş durum mesajı gösterir", () => {
    render(
      <FundSelectionStep
        funds={[]}
        selectedFundId=""
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage=""
      />,
    )

    expect(screen.getByText("Optimize edilebilir fon yok.")).toBeInTheDocument()
  })

  it("fonları listeler ve seçili olanı işaretler", () => {
    render(
      <FundSelectionStep
        funds={FUNDS}
        selectedFundId={FUNDS[0].id}
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage=""
      />,
    )

    expect(screen.getByText("Finovation Atlas Fonu")).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: "Finovation Atlas Fonu fonunu seç" }),
    ).toBeChecked()
    expect(
      screen.getByRole("radio", { name: "Finovation Nova Fonu fonunu seç" }),
    ).not.toBeChecked()
  })

  it("bir fona tıklanınca onSelectFund'ı doğru id ile çağırır", async () => {
    const user = userEvent.setup()
    const onSelectFund = vi.fn()

    render(
      <FundSelectionStep
        funds={FUNDS}
        selectedFundId={FUNDS[0].id}
        onSelectFund={onSelectFund}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage=""
      />,
    )

    await user.click(
      screen.getByRole("radio", { name: "Finovation Nova Fonu fonunu seç" }),
    )

    expect(onSelectFund).toHaveBeenCalledWith(FUNDS[1].id)
  })

  it("fon seçilmeden devam butonu devre dışıdır", () => {
    render(
      <FundSelectionStep
        funds={FUNDS}
        selectedFundId=""
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage=""
      />,
    )

    expect(
      screen.getByRole("button", { name: "Optimizasyona Başla" }),
    ).toBeDisabled()
  })

  it("devam butonuna tıklanınca onContinue'yu çağırır", async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()

    render(
      <FundSelectionStep
        funds={FUNDS}
        selectedFundId={FUNDS[0].id}
        onSelectFund={vi.fn()}
        onContinue={onContinue}
        isLoading={false}
        errorMessage=""
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Optimizasyona Başla" }),
    )

    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
