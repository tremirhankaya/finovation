import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  FundMonitoringView,
  type FundMonitoringViewProps,
} from "@/features/fund-monitoring/pages/FundMonitoringPage"

const READY_PROPS: FundMonitoringViewProps = {
  funds: [
    {
      id: "fund-1",
      name: "Büyüme Fonu",
      type: "Hisse Senedi Yoğun Fon",
    },
  ],
  selectedFundId: "fund-1",
  snapshot: {
    fund: {
      id: "fund-1",
      name: "Büyüme Fonu",
      type: "Hisse Senedi Yoğun Fon",
    },
    asOfDate: "2026-08-04",
    currency: "TRY",
    currentSharePrice: 18.4271,
    dailyChangePercentage: 1.24,
    priceHistory: {
      "1M": [
        { date: "2026-07-04", value: 17.1 },
        { date: "2026-08-04", value: 18.4271 },
      ],
      "3M": [
        { date: "2026-05-04", value: 16.2 },
        { date: "2026-08-04", value: 18.4271 },
      ],
    },
    technicalIndicators: [
      {
        code: "VOLATILITY",
        label: "Volatilite (Yıllık)",
        value: 24.6,
        unit: "PERCENT",
      },
      {
        code: "SHARPE",
        label: "Sharpe Oranı",
        value: 1.34,
        unit: "RATIO",
        tone: "positive",
      },
    ],
    periodReturns: [
      { period: "1M", label: "1 Aylık Getiri", value: 4.2 },
      { period: "3M", label: "3 Aylık Getiri", value: 11.8 },
      { period: "6M", label: "6 Aylık Getiri", value: 19.5 },
    ],
    positions: [
      {
        assetId: "asset-1",
        symbol: "THYAO",
        name: "Türk Hava Yolları",
        sectorName: "Ulaştırma",
        weightPercentage: 12.4,
      },
    ],
    sectorAllocations: [
      {
        sectorId: "sector-1",
        sectorName: "Ulaştırma",
        weightPercentage: 12.4,
      },
    ],
    comparisonAssets: [
      {
        id: "fund-1",
        code: "BUY",
        name: "Büyüme Fonu",
        color: "#0d9488",
        isFund: true,
        returns: { "1M": 4.2, "3M": 11.8, "1Y": 28.4 },
      },
      {
        id: "gold",
        code: "ALTIN",
        name: "Altın",
        color: "#eda100",
        returns: { "1M": 2.1, "3M": 8.3, "1Y": 34.6 },
      },
      {
        id: "bist-100",
        code: "BIST100",
        name: "BIST 100",
        color: "#378add",
        returns: { "1M": -1.2, "3M": 5.4, "1Y": 19.7 },
      },
    ],
  },
}

describe("FundMonitoringView", () => {
  it("fon yok durumunda bütün izleme bölümlerini boş iskeletle gösterir", () => {
    render(<FundMonitoringView funds={[]} selectedFundId="" snapshot={null} />)

    expect(screen.getByText("Henüz bir fon oluşturmadınız")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Teknik Göstergeler" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Tüm Varlıklar" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Sektörel Dağılım" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Fon Getiri Karşılaştır" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Karşılaştırma verileri aktif bir fon oluşturulduğunda burada gösterilecek.",
      ),
    ).toBeInTheDocument()
  })

  it("görünüm modelinden gelen fon verilerini ilgili kartlarda gösterir", () => {
    render(<FundMonitoringView {...READY_PROPS} />)

    expect(screen.getByText("₺18,4271")).toBeInTheDocument()
    expect(screen.getByText("%24,60")).toBeInTheDocument()
    expect(screen.getByText("THYAO")).toBeInTheDocument()
    expect(screen.getAllByText("Ulaştırma")).toHaveLength(2)
    expect(
      screen.getByRole("img", {
        name: "Büyüme Fonu pay fiyatı değişim grafiği",
      }),
    ).toBeInTheDocument()
  })

  it("fiyat grafiği dönem seçimini kullanıcı etkileşimiyle değiştirir", async () => {
    const user = userEvent.setup()
    render(<FundMonitoringView {...READY_PROPS} />)

    const threeMonths = screen.getByRole("button", { name: "3A" })
    expect(threeMonths).toHaveAttribute("aria-pressed", "false")

    await user.click(threeMonths)

    expect(threeMonths).toHaveAttribute("aria-pressed", "true")
  })

  it("fon değişikliğini dış veri katmanına iletir", async () => {
    const user = userEvent.setup()
    const onFundChange = vi.fn()
    const funds = [
      ...READY_PROPS.funds,
      { id: "fund-2", name: "Denge Fonu", type: "Karma Fon" },
    ]

    render(
      <FundMonitoringView
        {...READY_PROPS}
        funds={funds}
        onFundChange={onFundChange}
      />,
    )

    await user.selectOptions(screen.getByLabelText("İzlenen fon"), "fund-2")

    expect(onFundChange).toHaveBeenCalledWith("fund-2")
  })

  it("getiri karşılaştırmasını dönem ve görünüm seçimleriyle günceller", async () => {
    const user = userEvent.setup()
    render(<FundMonitoringView {...READY_PROPS} />)

    expect(
      screen.getByRole("heading", { name: "Fon Getiri Karşılaştır" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("img", {
        name: "Seçili varlıkların dönemsel getirisini gösteren sütun grafik",
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tablo" }))

    expect(
      screen.getByRole("columnheader", { name: "1 Yıllık Getiri" }),
    ).toBeInTheDocument()
    expect(screen.getByText("+%34,60")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "3 Aylık" }))

    expect(
      screen.getByRole("columnheader", { name: "3 Aylık Getiri" }),
    ).toBeInTheDocument()
    expect(screen.getByText("+%11,80", { selector: "td" })).toBeInTheDocument()
  })

  it("karşılaştırma varlıklarını listeden çıkarıp arama penceresinden ekler", async () => {
    const user = userEvent.setup()
    render(<FundMonitoringView {...READY_PROPS} />)

    await user.click(screen.getByRole("checkbox", { name: "Altın" }))
    expect(screen.getByRole("checkbox", { name: "Altın" })).not.toBeChecked()

    await user.click(
      screen.getByRole("button", {
        name: "Aradığınız fonun kodunu veya adını yazınız",
      }),
    )
    await user.type(
      screen.getByPlaceholderText("Fon kodu veya varlık adı yazınız..."),
      "ALT",
    )
    await user.click(screen.getByRole("button", { name: /Altın\s*ALTIN/ }))

    expect(screen.getByRole("checkbox", { name: "Altın" })).toBeChecked()
  })
})
