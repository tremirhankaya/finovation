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
    benchmark: {
      name: "Fon Karşılaştırma Ölçütü",
      components: [
        {
          code: "XU100_CFNNTLTL",
          name: "BIST 100 Getiri Endeksi",
          weightPercentage: 90,
        },
        {
          code: "REPBR",
          name: "BIST-KYD Repo (Brüt) Endeksi",
          weightPercentage: 10,
        },
      ],
    },
    technicalIndicators: [
      {
        code: "VOLATILITY",
        label: "Volatilite (Yıllık)",
        value: 24.6,
        unit: "PERCENT",
        description: "Son 252 işlem günündeki yıllıklandırılmış dalgalanma.",
      },
      {
        code: "SHARPE",
        label: "Sharpe Oranı",
        value: 1.34,
        unit: "RATIO",
        tone: "positive",
        description: "Risksiz getiri üzerindeki performans.",
      },
    ],
    periodReturns: [
      { period: "1M", label: "1 Aylık Getiri", value: 4.2 },
      { period: "3M", label: "3 Aylık Getiri", value: 11.8 },
      { period: "6M", label: "6 Aylık Getiri", value: 19.5 },
      { period: "1Y", label: "1 Yıllık Getiri", value: 28.4 },
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
        id: "gold-try",
        code: "ALTIN",
        name: "Altın",
        color: "#eda100",
        returns: { "1M": 2.1, "3M": 8.3, "1Y": 34.6 },
      },
      {
        id: "bist-100-return",
        code: "BIST100",
        name: "BIST 100",
        color: "#378add",
        returns: { "1M": -1.2, "3M": 5.4, "1Y": 19.7 },
      },
      {
        id: "similar-fund-mac",
        code: "MAC",
        name: "Marmara Capital Portföy Hisse Senedi Fonu",
        color: "#7c3aed",
        isFund: true,
        returns: { "1M": 3.1, "3M": 9.4, "1Y": 31.2 },
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
      screen.queryByRole("button", { name: "Kopyala" }),
    ).not.toBeInTheDocument()
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
    expect(screen.getByText("1 Yıllık Getiri").parentElement).toHaveTextContent(
      "+%28,40",
    )
    expect(screen.getByText("THYAO")).toBeInTheDocument()
    expect(
      screen.queryByText("Fon Karşılaştırma Ölçütü"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("BIST 100 Getiri Endeksi"),
    ).not.toBeInTheDocument()
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

  it("yeni fonun tek fiyat noktasını boş grafik gibi göstermez", () => {
    const props = {
      ...READY_PROPS,
      snapshot: {
        ...READY_PROPS.snapshot!,
        priceHistory: {
          "1M": [{ date: "2026-08-04", value: 50 }],
        },
      },
    }

    render(<FundMonitoringView {...props} />)

    expect(
      screen.getByText(
        "Fon yeni oluşturulduğu için henüz tek fiyat verisi bulunuyor.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Grafik verisi fon seçildikten sonra gösterilecek."),
    ).not.toBeInTheDocument()
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

  it("benchmark bilgi ikonunda karşılaştırma ölçütü değerlerini gösterir", async () => {
    const user = userEvent.setup()
    const props = {
      ...READY_PROPS,
      snapshot: {
        ...READY_PROPS.snapshot!,
        comparisonAssets: [
          ...(READY_PROPS.snapshot!.comparisonAssets ?? []),
          {
            id: "official-equity-benchmark",
            code: "BENCHMARK",
            name: "BENCHMARK",
            color: "#dc2626",
            returns: { "1Y": 24.1 },
          },
        ],
      },
    }

    render(<FundMonitoringView {...props} />)

    const infoButton = screen.getByRole("button", {
      name: "Benchmark karşılaştırma ölçütü değerleri",
    })
    await user.hover(infoButton)

    const tooltipId = infoButton.getAttribute("aria-describedby")
    const tooltip = document.getElementById(tooltipId!)
    expect(tooltip).toHaveAttribute("role", "tooltip")
    expect(tooltip).toHaveTextContent("Fon Karşılaştırma Ölçütü")
    expect(tooltip).toHaveTextContent("BIST 100 Getiri Endeksi%90")
    expect(tooltip).toHaveTextContent("BIST-KYD Repo (Brüt) Endeksi%10")
  })

  it("karşılaştırma varlıklarını listeden çıkarıp arama penceresinden ekler", async () => {
    const user = userEvent.setup()
    render(<FundMonitoringView {...READY_PROPS} />)

    await user.click(screen.getByRole("checkbox", { name: "Altın" }))
    expect(
      screen.queryByRole("checkbox", { name: "Altın" }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: /Karşılaştırmaya varlık ekle/,
      }),
    )
    await user.type(
      screen.getByPlaceholderText("Fon kodu veya varlık adı yazınız..."),
      "ALT",
    )
    await user.click(screen.getByRole("button", { name: /Altın\s*ALTIN/ }))

    expect(screen.getByRole("checkbox", { name: "Altın" })).toBeChecked()
  })

  it("istenen dokuz karşılaştırma varlığını varsayılan seçer", () => {
    const defaultAssets = [
      ...(READY_PROPS.snapshot!.comparisonAssets ?? []),
      {
        id: "official-equity-benchmark",
        code: "BENCHMARK",
        name: "Karşılaştırma Ölçütü",
        color: "#dc2626",
        returns: { "1Y": 24.1 },
      },
      {
        id: "bist-30",
        code: "BIST30",
        name: "BIST 30",
        color: "#2563eb",
        returns: { "1Y": 18.2 },
      },
      {
        id: "deposit-try",
        code: "MEVDUAT",
        name: "Mevduat Getirisi",
        color: "#0f766e",
        returns: { "1Y": 50.6 },
      },
      {
        id: "inflation",
        code: "TUFE",
        name: "TÜFE",
        color: "#ea580c",
        returns: { "1Y": 32.8 },
      },
      {
        id: "usd-try",
        code: "USD/TRY",
        name: "USD/TRY",
        color: "#16a34a",
        returns: { "1Y": 21.3 },
      },
      {
        id: "eur-try",
        code: "EUR/TRY",
        name: "EUR/TRY",
        color: "#0284c7",
        returns: { "1Y": 36.9 },
      },
      {
        id: "repo-gross",
        code: "REPBR",
        name: "Repo Endeksi",
        color: "#0891b2",
        returns: { "1Y": 54.2 },
      },
    ]
    const props = {
      ...READY_PROPS,
      snapshot: {
        ...READY_PROPS.snapshot!,
        comparisonAssets: defaultAssets,
      },
    }

    render(<FundMonitoringView {...props} />)

    expect(screen.getAllByRole("checkbox")).toHaveLength(9)
    expect(screen.getByRole("checkbox", { name: "Büyüme Fonu" })).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Karşılaştırma Ölçütü" }),
    ).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "BIST 100" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "BIST 30" })).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Mevduat Getirisi" }),
    ).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "TÜFE" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Altın" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "USD/TRY" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "EUR/TRY" })).toBeChecked()
    expect(
      screen.queryByRole("checkbox", { name: "Repo Endeksi" }),
    ).not.toBeInTheDocument()
  })

  it("benzer fonları varsayılan seçmez ve varlık ekleme penceresinde ayrı gruplar", async () => {
    const user = userEvent.setup()
    render(<FundMonitoringView {...READY_PROPS} />)

    expect(
      screen.queryByRole("checkbox", {
        name: "Marmara Capital Portföy Hisse Senedi Fonu",
      }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: /Karşılaştırmaya varlık ekle/ }),
    )

    expect(
      screen.getByRole("heading", { name: "Benzer Fonlar" }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: /Marmara Capital Portföy Hisse Senedi Fonu\s*MAC/,
      }),
    )

    expect(
      screen.getByRole("checkbox", {
        name: "Marmara Capital Portföy Hisse Senedi Fonu",
      }),
    ).toBeChecked()
  })
})
