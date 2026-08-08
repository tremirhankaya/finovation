import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import StressTestHistory from "@/features/stress-test/components/StressTestHistory"

const HISTORY = [
  {
    testId: "11111111-1111-4111-8111-111111111111",
    scenarioCode: "GLOBAL_CRISIS",
    scenarioName: "Küresel Kriz",
    asOfDate: "2026-08-07",
    portfolioImpact: -0.042,
    createdAt: "2026-08-07T16:30:15",
  },
]

describe("StressTestHistory", () => {
  it("geçmiş stres testi sonucunu gösterir", () => {
    render(
        <StressTestHistory
            tests={HISTORY}
            isLoading={false}
            errorMessage=""
            onDetail={vi.fn()}
            onDelete={vi.fn()}
        />,
    )

    expect(screen.getByText("Küresel Kriz")).toBeInTheDocument()
    expect(screen.getByText("07.08.2026")).toBeInTheDocument()
    expect(screen.getByText("-4.20%")).toBeInTheDocument()
  })

  it("detay butonunda ilgili test id'sini gönderir", async () => {
    const user = userEvent.setup()
    const onDetail = vi.fn()

    render(
        <StressTestHistory
            tests={HISTORY}
            isLoading={false}
            errorMessage=""
            onDetail={onDetail}
            onDelete={vi.fn()}
        />,
    )

    await user.click(
        screen.getByRole("button", { name: "Detay" }),
    )

    expect(onDetail).toHaveBeenCalledOnce()
    expect(onDetail).toHaveBeenCalledWith(HISTORY[0].testId)
  })

  it("sil butonunda ilgili test id'sini gönderir", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
        <StressTestHistory
            tests={HISTORY}
            isLoading={false}
            errorMessage=""
            onDetail={vi.fn()}
            onDelete={onDelete}
        />,
    )

    await user.click(
        screen.getByRole("button", { name: "Sil" }),
    )

    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(HISTORY[0].testId)
  })

  it("geçmiş boşsa empty state gösterir", () => {
    render(
        <StressTestHistory
            tests={[]}
            isLoading={false}
            errorMessage=""
            onDetail={vi.fn()}
            onDelete={vi.fn()}
        />,
    )

    expect(
        screen.getByText(
            "Henüz çalıştırılmış bir stres testi bulunmuyor.",
        ),
    ).toBeInTheDocument()
  })

  it("geçmiş yüklenirken loading state gösterir", () => {
    render(
        <StressTestHistory
            tests={[]}
            isLoading
            errorMessage=""
            onDetail={vi.fn()}
            onDelete={vi.fn()}
        />,
    )

    expect(
        screen.getByText("Stres testi geçmişi yükleniyor…"),
    ).toBeInTheDocument()
  })
})