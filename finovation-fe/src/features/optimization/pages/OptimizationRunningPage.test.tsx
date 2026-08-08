import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  OptimizationRunningView,
  type OptimizationRunningViewProps,
} from "@/features/optimization/pages/OptimizationRunningPage"

const RUNNING_PROPS: OptimizationRunningViewProps = {
  fundId: "11111111-1111-4111-8111-111111111111",
  riskProfile: "BALANCED",
  isRunning: true,
  isCompleted: false,
}

describe("OptimizationRunningView", () => {
  it("çalışırken yükleniyor durumunu ve fon/risk profili bilgisini gösterir", () => {
    render(<OptimizationRunningView {...RUNNING_PROPS} />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "Optimizasyon çalıştırılıyor",
    )
    expect(screen.getByText(/Fon #11111111/)).toBeInTheDocument()
    expect(screen.getByText(/Dengeli yaklaşım/)).toBeInTheDocument()
    expect(screen.getByText(/6 aylık değerlendirme vadesi/)).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true")
  })

  it("fundName verildiğinde ham fon ID'si yerine gerçek fon adını gösterir", () => {
    render(
      <OptimizationRunningView
        {...RUNNING_PROPS}
        fundName="Deneme Hisse Fonu"
      />,
    )

    expect(screen.getByText(/Deneme Hisse Fonu/)).toBeInTheDocument()
    expect(screen.queryByText(/Fon #11111111/)).not.toBeInTheDocument()
  })

  it("optimizasyon adımlarını listeler", () => {
    render(<OptimizationRunningView {...RUNNING_PROPS} />)

    expect(
      screen.getByRole("list", { name: "Optimizasyon adımları" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Model gerekçeleri oluşturuluyor"),
    ).toBeInTheDocument()
  })

  it("hata durumunda mesajı ve tekrar dene butonunu gösterir", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <OptimizationRunningView
        {...RUNNING_PROPS}
        isRunning={false}
        errorMessage="Optimizasyon motoru şu anda bağlı değil."
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Optimizasyon motoru şu anda bağlı değil.",
    )

    const retryButton = screen.getByRole("button", { name: "Tekrar Dene" })
    expect(retryButton).toBeEnabled()

    await user.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("yeniden denerken tekrar dene butonunu devre dışı bırakır", () => {
    render(
      <OptimizationRunningView
        {...RUNNING_PROPS}
        isRunning={true}
        errorMessage="Optimizasyon motoru şu anda bağlı değil."
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "Tekrar Dene" })).toBeDisabled()
  })

  it("tamamlandığında başarı durumunu ve sonuç butonunu gösterir", () => {
    render(
      <OptimizationRunningView
        {...RUNNING_PROPS}
        isRunning={false}
        isCompleted={true}
        onViewResult={vi.fn()}
      />,
    )

    expect(screen.getByText("Optimizasyon tamamlandı")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sonucu Görüntüle →" }),
    ).toBeInTheDocument()
  })

  it("sonucu görüntüle butonuna basınca callback'i tetikler", async () => {
    const user = userEvent.setup()
    const onViewResult = vi.fn()

    render(
      <OptimizationRunningView
        {...RUNNING_PROPS}
        isRunning={false}
        isCompleted={true}
        onViewResult={onViewResult}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Sonucu Görüntüle →" }))

    expect(onViewResult).toHaveBeenCalledTimes(1)
  })

  it("geri dön butonuna basınca callback'i tetikler", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()

    render(<OptimizationRunningView {...RUNNING_PROPS} onBack={onBack} />)

    await user.click(screen.getByRole("button", { name: "Panele dön" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
