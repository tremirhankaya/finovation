import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import RiskProfilePanel from "@/features/optimization/components/RiskProfilePanel"

describe("RiskProfilePanel", () => {
  it("üç risk yaklaşımı seçeneğini gösterir, seçili olanı işaretler", () => {
    render(<RiskProfilePanel value="BALANCED" onChange={vi.fn()} />)

    expect(screen.getByRole("radio", { name: /Agresif/ })).toHaveAttribute(
      "aria-checked",
      "false",
    )
    expect(screen.getByRole("radio", { name: /Dengeli/ })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(screen.getByRole("radio", { name: /Korumacı/ })).toHaveAttribute(
      "aria-checked",
      "false",
    )
  })

  it("bir seçeneğe tıklanınca onChange'i doğru değerle çağırır", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<RiskProfilePanel value="BALANCED" onChange={onChange} />)

    await user.click(screen.getByRole("radio", { name: /Agresif/ }))

    expect(onChange).toHaveBeenCalledWith("AGGRESSIVE")
  })
})
