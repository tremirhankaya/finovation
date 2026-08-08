import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import SectorDonut from "@/features/fund-monitoring/components/SectorDonut"

const ALLOCATIONS = [
  {
    sectorId: "technology",
    sectorName: "Teknoloji",
    weightPercentage: 42.5,
  },
  {
    sectorId: "transportation",
    sectorName: "Ulaştırma",
    weightPercentage: 57.5,
  },
]

describe("SectorDonut", () => {
  it("hover edilen dilimin sektörünü ve yüzdesini gösterir", () => {
    render(<SectorDonut allocations={ALLOCATIONS} />)

    const technologySlice = screen.getByLabelText("Teknoloji: %42,5")
    fireEvent.pointerEnter(technologySlice)

    expect(screen.getByRole("status")).toHaveTextContent("Teknoloji")
    expect(screen.getByRole("status")).toHaveTextContent("%42,5")

    fireEvent.pointerLeave(technologySlice)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("klavye odağında da dilim bilgisini gösterir", () => {
    render(<SectorDonut allocations={ALLOCATIONS} />)

    fireEvent.focus(screen.getByLabelText("Ulaştırma: %57,5"))

    expect(screen.getByRole("status")).toHaveTextContent("Ulaştırma")
    expect(screen.getByRole("status")).toHaveTextContent("%57,5")
  })
})
