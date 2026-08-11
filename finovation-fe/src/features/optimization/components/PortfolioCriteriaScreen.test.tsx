import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import PortfolioCriteriaScreen from "@/features/optimization/components/PortfolioCriteriaScreen"
import type { CriteriaRow } from "@/features/optimization/lib/optimizationCriteriaRows"
import type { OptimizationResultAsset } from "@/features/optimization/model/optimizationResultSchemas"

function asset(
  overrides: Partial<OptimizationResultAsset> & { assetCode: string },
): OptimizationResultAsset {
  return {
    name: overrides.assetCode,
    sectorName: null,
    assetType: "EQUITY",
    currentWeight: 5,
    proposedWeight: 5,
    finalWeight: null,
    changeAmount: 0,
    actionType: "KEEP",
    manuallyOverridden: false,
    rationale: null,
    userLocked: false,
    ...overrides,
  }
}

const BASE_PROPS = {
  fundName: "Finovation Atlas Fonu",
  rows: [],
  rationaleAssets: [],
  isApprovalBlocked: false,
  isSubmitting: false,
  submitErrorMessage: "",
  onExportPdf: vi.fn(),
  isExportingPdf: false,
  onExportExcel: vi.fn(),
  isExportingExcel: false,
  onEditWeights: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
}

const CRITERIA_ROWS: CriteriaRow[] = [
  {
    key: "TOTAL_PORTFOLIO_WEIGHT",
    label: "Toplam Portföy Ağırlığı",
    currentValue: 100,
    proposedValue: 100,
    status: "GREEN",
    detail: "Hisse + TPP toplamı %100 olmalı",
    unit: "PERCENT",
  },
  {
    key: "MAX_SINGLE_STOCK_WEIGHT",
    label: "En Yüksek Tek Hisse Ağırlığı",
    currentValue: 8,
    proposedValue: 10,
    status: "AMBER",
    detail: "Üst limit %10",
    unit: "PERCENT",
  },
  {
    key: "VOLATILITY",
    label: "Volatilite",
    currentValue: 19.4,
    proposedValue: 19.68,
    status: "GREEN",
    detail: "0.28 puan arttı, eşik altında",
    unit: "RATIO",
  },
  {
    key: "MAX_DRAWDOWN",
    label: "Maksimum Düşüş",
    currentValue: -9.75,
    proposedValue: -10.14,
    status: "RED",
    detail: "Eşik aşıldı",
    unit: "RATIO",
  },
  {
    key: "TRACKING_ERROR",
    label: "Tracking Error",
    currentValue: 5.75,
    proposedValue: 6.42,
    status: "NEUTRAL",
    detail: "Amaca bağlı yorumlanır",
    unit: "RATIO",
  },
]

describe("PortfolioCriteriaScreen — Kriter Tablosu", () => {
  it("Değişim rengini yön yerine kriterin durumuna göre uygular", () => {
    render(<PortfolioCriteriaScreen {...BASE_PROPS} rows={CRITERIA_ROWS} />)

    const volatilityDelta = screen.getByText("+0.28")
    expect(volatilityDelta.className).toContain("metricStatusGREEN")

    const drawdownDelta = screen.getByText("-0.39")
    expect(drawdownDelta.className).toContain("metricStatusRED")

    const trackingErrorDelta = screen.getByText("+0.67")
    expect(trackingErrorDelta.className).toContain("metricStatusNEUTRAL")
  })

  it("kısıt kriterleri ile risk/getiri metrikleri arasına bir bölüm ayracı ekler", () => {
    render(<PortfolioCriteriaScreen {...BASE_PROPS} rows={CRITERIA_ROWS} />)

    expect(screen.getByText("Risk ve Getiri Metrikleri")).toBeInTheDocument()
    expect(screen.getAllByText("Risk ve Getiri Metrikleri")).toHaveLength(1)
  })

  it("kısıt kriterleri boşken bölüm ayracı eklemez", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rows={CRITERIA_ROWS.filter((row) => row.unit !== "RATIO")}
      />,
    )

    expect(
      screen.queryByText("Risk ve Getiri Metrikleri"),
    ).not.toBeInTheDocument()
  })

  it("Değişim, gösterilen (yuvarlanmış) Mevcut/Optimize değerleriyle tutarlıdır", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rows={[
          {
            key: "BETA",
            label: "Beta",
            currentValue: 0.984,
            proposedValue: 0.986,
            status: "GREEN",
            detail: "0.00 puan arttı, eşik altında",
            unit: "RATIO",
          },
          {
            key: "TOTAL_EQUITY_WEIGHT",
            label: "Toplam Hisse Ağırlığı",
            currentValue: 87.6,
            proposedValue: 88.4,
            status: "GREEN",
            detail: "İzahname %85–%95, hedef bant %86–%94",
            unit: "PERCENT",
          },
        ]}
      />,
    )

    expect(screen.getByText("0.98")).toBeInTheDocument()
    expect(screen.getByText("0.99")).toBeInTheDocument()
    expect(screen.getByText("+0.01")).toBeInTheDocument()
    expect(screen.queryByText("+0.00")).not.toBeInTheDocument()

    expect(screen.getAllByText("%88")).toHaveLength(2)
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})

describe("PortfolioCriteriaScreen — Model Gerekçeleri", () => {
  it("her hisse için ayrı bir kart gösterir", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "MGROS.E",
            actionType: "INCREASE",
            rationale: "MGROS gerekçesi",
          }),
          asset({
            assetCode: "TTKOM.E",
            actionType: "DECREASE",
            rationale: "TTKOM gerekçesi",
          }),
        ]}
      />,
    )

    expect(screen.getByText("MGROS.E")).toBeInTheDocument()
    expect(screen.getByText("TTKOM.E")).toBeInTheDocument()
  })

  it("gerekçe metnini varsayılan olarak gizler, butona tıklayınca gösterir", async () => {
    const user = userEvent.setup()

    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "AKBNK.E",
            actionType: "INCREASE",
            rationale: "Detaylı gerekçe metni burada",
          }),
        ]}
      />,
    )

    expect(
      screen.queryByText("Detaylı gerekçe metni burada"),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "AKBNK.E gerekçesini göster" }),
    )

    expect(
      screen.getByText("Detaylı gerekçe metni burada"),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "AKBNK.E gerekçesini gizle" }),
    )

    expect(
      screen.queryByText("Detaylı gerekçe metni burada"),
    ).not.toBeInTheDocument()
  })

  it("artan hissede yeşil, azalan hissede kırmızı, sabitte gri nokta sınıfı uygular", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({ assetCode: "UP.E", actionType: "INCREASE", rationale: "r" }),
          asset({
            assetCode: "DOWN.E",
            actionType: "DECREASE",
            rationale: "r",
          }),
          asset({ assetCode: "FLAT.E", actionType: "KEEP", rationale: "r" }),
        ]}
      />,
    )

    const upDot = screen.getByText("UP.E").querySelector("span")
    const downDot = screen.getByText("DOWN.E").querySelector("span")
    const flatDot = screen.getByText("FLAT.E").querySelector("span")

    expect(upDot?.className).toContain("rationaleDotUp")
    expect(downDot?.className).toContain("rationaleDotDown")
    expect(flatDot?.className).toContain("rationaleDotFlat")
  })

  it("rationaleAssets boşken bölümü hiç göstermez", () => {
    render(<PortfolioCriteriaScreen {...BASE_PROPS} rationaleAssets={[]} />)

    expect(screen.queryByText("Model Gerekçeleri")).not.toBeInTheDocument()
  })

  it("aynı sektördeki hisseleri yan yana kümeler, başlık eklemez", () => {
    render(
      <PortfolioCriteriaScreen
        {...BASE_PROPS}
        rationaleAssets={[
          asset({
            assetCode: "TTKOM.E",
            sectorName: "Telekomünikasyon",
            rationale: "r",
          }),
          asset({
            assetCode: "AKBNK.E",
            sectorName: "Bankacılık",
            rationale: "r",
          }),
          asset({
            assetCode: "GARAN.E",
            sectorName: "Bankacılık",
            rationale: "r",
          }),
        ]}
      />,
    )

    const cardNames = screen
      .getAllByText(/\.E$/)
      .map((el) => el.textContent?.trim())

    expect(cardNames).toEqual(["AKBNK.E", "GARAN.E", "TTKOM.E"])
    expect(screen.queryByText("Bankacılık")).not.toBeInTheDocument()
    expect(screen.queryByText("Telekomünikasyon")).not.toBeInTheDocument()
  })
})
