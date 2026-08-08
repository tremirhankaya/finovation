import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import StressScenarioCards from "@/features/stress-test/components/StressScenarioCards"

const SCENARIOS = [
  {
    code: "GLOBAL_CRISIS",
    name: "Küresel Kriz",
    description: "Küresel piyasalarda sert riskten kaçış yaşanır.",
  },
  {
    code: "RATE_CUT_SHOCK",
    name: "Faiz İndirimi",
    description: "Faiz oranlarında sert düşüş gerçekleşir.",
  },
]

describe("StressScenarioCards", () => {
  it("backendden gelen senaryoları kullanıcıya gösterir", () => {
    render(
      <StressScenarioCards
        scenarios={SCENARIOS}
        onRun={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Küresel Kriz" }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole("heading", { name: "Faiz İndirimi" }),
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole("button", { name: "Testi Çalıştır" }),
    ).toHaveLength(2)
  })

  it("fon seçilemediğinde test butonlarını devre dışı bırakır", () => {
    render(
      <StressScenarioCards
        scenarios={SCENARIOS}
        disabled
        onRun={vi.fn()}
      />,
    )

    for (const button of screen.getAllByRole("button", {
      name: "Testi Çalıştır",
    })) {
      expect(button).toBeDisabled()
    }
  })

  it("senaryo olmadığında açıklayıcı empty state gösterir", () => {
    render(
      <StressScenarioCards
        scenarios={[]}
        onRun={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        "Şu anda kullanılabilir stres senaryosu bulunmuyor.",
      ),
    ).toBeInTheDocument()
  })

  it("kullanıcı seçtiği stres senaryosunu çalıştırabilir", async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()

    render(
      <StressScenarioCards
        scenarios={SCENARIOS}
        onRun={onRun}
      />,
    )

    await user.click(
      screen.getAllByRole("button", {
        name: "Testi Çalıştır",
      })[0],
    )

    expect(onRun).toHaveBeenCalledOnce()
    expect(onRun).toHaveBeenCalledWith("GLOBAL_CRISIS")
  })

  it("test çalışırken yeni test başlatılmasını engeller", () => {
    render(
      <StressScenarioCards
        scenarios={SCENARIOS}
        runningScenarioCode="GLOBAL_CRISIS"
        onRun={vi.fn()}
      />,
    )

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
  })
})

