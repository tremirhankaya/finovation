import { describe, expect, it } from "vitest"

import { buildRiskMetricsSnapshots } from "@/features/optimization/lib/optimizationRiskMetricsInput"
import type { OptimizationResultMetric } from "@/features/optimization/model/optimizationResultSchemas"

describe("buildRiskMetricsSnapshots", () => {
  it("metrik yokken tüm alanları null döner", () => {
    const { current, proposed } = buildRiskMetricsSnapshots([])

    expect(current.beta).toBeNull()
    expect(current.sharpeRatio).toBeNull()
    expect(proposed.beta).toBeNull()
    expect(proposed.sharpeRatio).toBeNull()
  })

  it("bilinen anahtarları doğru alanlara eşler", () => {
    const metrics: OptimizationResultMetric[] = [
      { key: "BETA", currentValue: 1.1, proposedValue: 0.95 },
      { key: "SHARPE_RATIO", currentValue: 0.8, proposedValue: 1.2 },
      { key: "MAX_DRAWDOWN", currentValue: -20, proposedValue: -18 },
    ]

    const { current, proposed } = buildRiskMetricsSnapshots(metrics)

    expect(current.beta).toBe(1.1)
    expect(proposed.beta).toBe(0.95)
    expect(current.sharpeRatio).toBe(0.8)
    expect(proposed.sharpeRatio).toBe(1.2)
    expect(current.maxDrawdown).toBe(-20)
    expect(proposed.maxDrawdown).toBe(-18)
    expect(current.alpha).toBeNull()
  })

  it("bilinmeyen bir anahtarı sessizce atlar", () => {
    const metrics: OptimizationResultMetric[] = [
      { key: "UNKNOWN_METRIC", currentValue: 5, proposedValue: 6 },
    ]

    const { current, proposed } = buildRiskMetricsSnapshots(metrics)

    expect(current.beta).toBeNull()
    expect(proposed.beta).toBeNull()
  })

  it("null değerleri olduğu gibi taşır", () => {
    const metrics: OptimizationResultMetric[] = [
      { key: "ALPHA", currentValue: null, proposedValue: 1.5 },
    ]

    const { current, proposed } = buildRiskMetricsSnapshots(metrics)

    expect(current.alpha).toBeNull()
    expect(proposed.alpha).toBe(1.5)
  })
})
