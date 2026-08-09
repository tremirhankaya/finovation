import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import FundSelectionStep from "@/features/optimization/components/FundSelectionStep"
import type { OptimizableFund } from "@/features/optimization/model/optimizationForm.types"

const FUNDS: OptimizableFund[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Finovation Atlas Fonu",
    typeLabel: "Hisse Senedi Yoğun Fon",
    active: true,
    lastOptimizationDate: "28.07.2026",
    stockCount: 18,
    sectorCount: 12,
    equityWeightPercent: 90,
    tppWeightPercent: 10,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Finovation Nova Fonu",
    typeLabel: "Hisse Senedi Yoğun Fon",
    active: true,
    lastOptimizationDate: null,
    stockCount: 14,
    sectorCount: 9,
    equityWeightPercent: 82,
    tppWeightPercent: 10,
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
    expect(screen.getByText("18 hisse · 12 sektör")).toBeInTheDocument()
    expect(screen.getByText("28.07.2026")).toBeInTheDocument()
    expect(screen.getByText("Optimizasyon yapılmadı")).toBeInTheDocument()
    expect(screen.getByText("%90 / %10")).toBeInTheDocument()
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
