import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import MetricComplianceSummaryPanel from "@/features/optimization/components/MetricComplianceSummaryPanel"
import type {
  ConstraintMetric,
  InfoMetric,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"

const CONSTRAINT_METRICS: ConstraintMetric[] = [
  {
    key: "TOTAL_EQUITY_WEIGHT",
    label: "Toplam Hisse Ağırlığı",
    value: 90,
    status: "GREEN",
    detail: "İzahname %85–%95, hedef bant %86–%94",
  },
  {
    key: "MAX_SECTOR_CONCENTRATION",
    label: "En Yüksek Sektör Yoğunlaşması",
    value: 35,
    status: "RED",
    detail: "Üst limit %30",
  },
]

const INFO_METRICS: InfoMetric[] = [
  {
    key: "BETA",
    label: "Beta",
    currentValue: 1.05,
    proposedValue: 0.98,
    status: "GREEN",
    detail: "Azaldı",
  },
  {
    key: "TRACKING_ERROR",
    label: "Tracking Error",
    currentValue: 3.4,
    proposedValue: 2.9,
    status: "NEUTRAL",
    detail: "Amaca bağlı yorumlanır",
  },
]

describe("MetricComplianceSummaryPanel", () => {
  it("taslak uyarısını gösterir", () => {
    render(
      <MetricComplianceSummaryPanel
        constraintMetrics={CONSTRAINT_METRICS}
        infoMetrics={INFO_METRICS}
      />,
    )

    expect(screen.getByRole("note")).toHaveTextContent("taslak")
  })

  it("kısıt metriklerini durumlarıyla listeler", () => {
    render(
      <MetricComplianceSummaryPanel
        constraintMetrics={CONSTRAINT_METRICS}
        infoMetrics={INFO_METRICS}
      />,
    )

    expect(screen.getByText("Toplam Hisse Ağırlığı")).toBeInTheDocument()
    expect(screen.getAllByText("Uyumlu").length).toBeGreaterThan(0)
    expect(
      screen.getByText("En Yüksek Sektör Yoğunlaşması"),
    ).toBeInTheDocument()
    expect(screen.getByText("İhlal Var")).toBeInTheDocument()
  })

  it("kontrol edilemedi (gri) kısıt metriğini gösterir", () => {
    render(
      <MetricComplianceSummaryPanel
        constraintMetrics={[
          {
            key: "MAX_SECTOR_CONCENTRATION",
            label: "En Yüksek Sektör Yoğunlaşması",
            value: null,
            status: "GRAY",
            detail: "Kontrol Edilemedi — gerekli veri yok",
          },
        ]}
        infoMetrics={[]}
      />,
    )

    expect(screen.getByText("Kontrol Edilemedi")).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent === "— · Kontrol Edilemedi — gerekli veri yok",
      ),
    ).toBeInTheDocument()
  })

  it("bilgi metriklerini mevcut→önerilen değerleriyle listeler", () => {
    render(
      <MetricComplianceSummaryPanel
        constraintMetrics={CONSTRAINT_METRICS}
        infoMetrics={INFO_METRICS}
      />,
    )

    expect(screen.getByText("Beta")).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === " (1.1 → 1)"),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Kontrol Edilemedi").length).toBeGreaterThan(0)
  })
})
