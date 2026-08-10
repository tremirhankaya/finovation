import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import FundSelectionStep from "@/features/optimization/components/FundSelectionStep"
import type { OptimizableFund } from "@/features/optimization/model/optimizationForm.types"

const FUNDS: OptimizableFund[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Finovation Atlas Fonu",
    typeLabel: "Hisse Senedi Yoğun Fon",
    active: true,
    lastOptimizationDate: "28.07.2026",
    lastOptimizationDateRaw: "2026-07-28",
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
    lastOptimizationDateRaw: null,
    stockCount: 14,
    sectorCount: 9,
    equityWeightPercent: 82,
    tppWeightPercent: 10,
  },
]

function fundRows(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("radio").length > 0)
}

beforeEach(() => {
  window.localStorage.clear()
})

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
    expect(screen.getByText("Hisse %90")).toBeInTheDocument()
    expect(screen.getByText("Hisse %82")).toBeInTheDocument()
    expect(screen.getAllByText("TPP %10")).toHaveLength(2)
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

  it("son optimizasyon sütununa tıklayınca sıralama yönünü değiştirir", async () => {
    const user = userEvent.setup()

    const { container } = render(
      <FundSelectionStep
        funds={FUNDS}
        selectedFundId=""
        onSelectFund={vi.fn()}
        onContinue={vi.fn()}
        isLoading={false}
        errorMessage=""
      />,
    )

    const table = screen.getByRole("table")
    expect(
      fundRows(table).map((row) => within(row).getByRole("radio").getAttribute("aria-label")),
    ).toEqual([
      "Finovation Atlas Fonu fonunu seç",
      "Finovation Nova Fonu fonunu seç",
    ])

    await user.click(
      screen.getByRole("button", { name: /Son Optimizasyon/ }),
    )

    expect(
      fundRows(table).map((row) => within(row).getByRole("radio").getAttribute("aria-label")),
    ).toEqual([
      "Finovation Nova Fonu fonunu seç",
      "Finovation Atlas Fonu fonunu seç",
    ])
    expect(container).toBeTruthy()
  })

  it("bir fon sabitlenince listenin başına taşınır ve tercih localStorage'a yazılır", async () => {
    const user = userEvent.setup()

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

    const table = screen.getByRole("table")
    await user.click(
      screen.getByRole("button", { name: "Finovation Nova Fonu fonunu üste sabitle" }),
    )

    expect(
      fundRows(table).map((row) => within(row).getByRole("radio").getAttribute("aria-label")),
    ).toEqual([
      "Finovation Nova Fonu fonunu seç",
      "Finovation Atlas Fonu fonunu seç",
    ])

    expect(
      JSON.parse(
        window.localStorage.getItem("finovation.optimization.pinnedFundIds") ?? "[]",
      ),
    ).toEqual([FUNDS[1].id])
  })
})
