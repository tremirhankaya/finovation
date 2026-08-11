import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import FundHoldingsCard from "@/features/fund-monitoring/components/FundHoldingsCard"
import type { FundPosition } from "@/features/fund-monitoring/model/fundMonitoring.types"

const POSITIONS: FundPosition[] = [
  {
    assetId: "1",
    symbol: "ZZZ",
    name: "Zeta Teknoloji",
    sectorName: "Teknoloji",
    weightPercentage: 20,
  },
  {
    assetId: "2",
    symbol: "BBB",
    name: "Beta Bank",
    sectorName: "Bankacılık",
    weightPercentage: 40,
  },
  {
    assetId: "3",
    symbol: "AAA",
    name: "Alfa Bank",
    sectorName: "Bankacılık",
    weightPercentage: 20,
  },
]

function listedSymbols(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent ?? "")
}

describe("FundHoldingsCard", () => {
  it("varlık başlığına tıklanınca artan ve azalan sıralama yapar", async () => {
    const user = userEvent.setup()
    render(<FundHoldingsCard positions={POSITIONS} />)

    await user.click(screen.getByRole("button", { name: "Varlık: sıralama yok" }))
    expect(listedSymbols()).toEqual([
      expect.stringContaining("AAA"),
      expect.stringContaining("BBB"),
      expect.stringContaining("ZZZ"),
    ])

    await user.click(
      screen.getByRole("button", { name: "Varlık: artan, öncelik 1" }),
    )
    expect(listedSymbols()).toEqual([
      expect.stringContaining("ZZZ"),
      expect.stringContaining("BBB"),
      expect.stringContaining("AAA"),
    ])
  })

  it("sektör ve ağırlık sıralamalarını iki öncelik olarak birlikte uygular", async () => {
    const user = userEvent.setup()
    render(<FundHoldingsCard positions={POSITIONS} />)

    await user.click(screen.getByRole("button", { name: "Sektör: sıralama yok" }))
    await user.click(screen.getByRole("button", { name: "Ağırlık: sıralama yok" }))

    expect(
      screen.getByRole("button", { name: "Sektör: artan, öncelik 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Ağırlık: artan, öncelik 2" }),
    ).toBeInTheDocument()
    expect(listedSymbols()).toEqual([
      expect.stringContaining("AAA"),
      expect.stringContaining("BBB"),
      expect.stringContaining("ZZZ"),
    ])
  })
})
