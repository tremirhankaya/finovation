import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it } from "vitest"

import NoFundsAvailableStep from "@/features/optimization/components/NoFundsAvailableStep"

function renderStep() {
  return render(
    <MemoryRouter initialEntries={["/optimization-requests/new"]}>
      <Routes>
        <Route
          path="/optimization-requests/new"
          element={<NoFundsAvailableStep />}
        />
        <Route path="/fund-design" element={<div>Fon Oluşturma ekranı</div>} />
        <Route path="/dashboard" element={<div>Ana sayfa</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("NoFundsAvailableStep", () => {
  it("boş durum mesajını ve yönlendirme butonlarını gösterir", () => {
    renderStep()

    expect(
      screen.getByText("Optimize edilebilecek bir fon bulunamadı."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Fon Oluşturma Ekranına Git" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Ana Sayfaya Dön" }),
    ).toBeInTheDocument()
  })

  it("'Fon Oluşturma Ekranına Git' fon oluşturma ekranına yönlendirir", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(
      screen.getByRole("button", { name: "Fon Oluşturma Ekranına Git" }),
    )

    expect(screen.getByText("Fon Oluşturma ekranı")).toBeInTheDocument()
  })

  it("'Ana Sayfaya Dön' ana sayfaya yönlendirir", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Ana Sayfaya Dön" }))

    expect(screen.getByText("Ana sayfa")).toBeInTheDocument()
  })
})
