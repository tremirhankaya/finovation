import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import OptimizationWizardSteps from "@/features/optimization/components/OptimizationWizardSteps"

describe("OptimizationWizardSteps", () => {
  it("dört adımın etiketlerini gösterir", () => {
    render(<OptimizationWizardSteps currentStep={1} />)

    expect(screen.getByText("Fon Seçimi")).toBeInTheDocument()
    expect(screen.getByText("Tercihler ve Kısıtlar")).toBeInTheDocument()
    expect(screen.getByText("Sonuç ve Gerekçe")).toBeInTheDocument()
    expect(screen.getByText("Onay")).toBeInTheDocument()
  })

  it("geçerli adımı aria-current ile işaretler", () => {
    render(<OptimizationWizardSteps currentStep={2} />)

    const activeStep = screen.getByText("Tercihler ve Kısıtlar").closest("li")
    expect(activeStep).toHaveAttribute("aria-current", "step")

    const otherStep = screen.getByText("Fon Seçimi").closest("li")
    expect(otherStep).not.toHaveAttribute("aria-current")
  })
})
