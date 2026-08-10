import { describe, expect, it } from "vitest"

import {
  evaluateConstraintMetrics,
  evaluateInfoMetrics,
  isApprovalBlockedByConstraints,
} from "@/features/optimization/lib/optimizationMetricsEvaluation"
import type {
  ConstraintMetricInput,
  PortfolioRiskMetricsSnapshot,
} from "@/features/optimization/model/optimizationMetricsEvaluation.types"

const BASE_CONSTRAINT_INPUT: ConstraintMetricInput = {
  totalPortfolioWeight: 100,
  totalEquityWeight: 90,
  tppWeight: 10,
  tppUserMin: 5,
  tppUserMax: 15,
  stockCount: 22,
  stockCountUserMin: 16,
  stockCountUserMax: 30,
  maxSingleStockWeight: 7,
  maxSectorConcentration: 20,
}

function findMetric(
  metrics: ReturnType<typeof evaluateConstraintMetrics>,
  key: string,
) {
  const metric = metrics.find((item) => item.key === key)
  if (!metric) throw new Error(`metric not found: ${key}`)
  return metric
}

describe("evaluateConstraintMetrics — toplam portföy ağırlığı", () => {
  it("%100'e ±0.5 puan içindeyse yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalPortfolioWeight: 99.6,
    })
    expect(findMetric(metrics, "TOTAL_PORTFOLIO_WEIGHT").status).toBe("GREEN")
  })

  it("%100'den 0.5 puandan fazla saparsa kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalPortfolioWeight: 98,
    })
    expect(findMetric(metrics, "TOTAL_PORTFOLIO_WEIGHT").status).toBe("RED")
  })

  it("%100'ü aşarsa da kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalPortfolioWeight: 101.5,
    })
    expect(findMetric(metrics, "TOTAL_PORTFOLIO_WEIGHT").status).toBe("RED")
  })

  it("değer null ise gri döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalPortfolioWeight: null,
    })
    expect(findMetric(metrics, "TOTAL_PORTFOLIO_WEIGHT").status).toBe("GRAY")
  })

  it("toplam %100'den saparsa onayı engeller", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalPortfolioWeight: 97,
    })
    expect(isApprovalBlockedByConstraints(metrics)).toBe(true)
  })
})

describe("evaluateConstraintMetrics — toplam hisse ağırlığı", () => {
  it("86-94 arası yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalEquityWeight: 90,
    })
    expect(findMetric(metrics, "TOTAL_EQUITY_WEIGHT").status).toBe("GREEN")
  })

  it("85-86 veya 94-95 arası amber", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalEquityWeight: 85.5,
    })
    expect(findMetric(metrics, "TOTAL_EQUITY_WEIGHT").status).toBe("AMBER")
  })

  it("85-95 dışı kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalEquityWeight: 84,
    })
    expect(findMetric(metrics, "TOTAL_EQUITY_WEIGHT").status).toBe("RED")
  })
})

describe("evaluateConstraintMetrics — TPP ağırlığı", () => {
  it("kullanıcı aralığında yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      tppWeight: 9,
      tppUserMin: 8,
      tppUserMax: 12,
    })
    expect(findMetric(metrics, "TPP_WEIGHT").status).toBe("GREEN")
  })

  it("izahname içinde ama kullanıcı aralığı dışında amber", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      tppWeight: 6,
      tppUserMin: 8,
      tppUserMax: 12,
    })
    expect(findMetric(metrics, "TPP_WEIGHT").status).toBe("AMBER")
  })

  it("%5-15 dışı kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      tppWeight: 16,
      tppUserMin: 8,
      tppUserMax: 12,
    })
    expect(findMetric(metrics, "TPP_WEIGHT").status).toBe("RED")
  })
})

describe("evaluateConstraintMetrics — hisse sayısı", () => {
  it("kullanıcı aralığında yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      stockCount: 20,
      stockCountUserMin: 18,
      stockCountUserMax: 25,
    })
    expect(findMetric(metrics, "STOCK_COUNT").status).toBe("GREEN")
  })

  it("sistem sınırı dışı kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      stockCount: 15,
      stockCountUserMin: 18,
      stockCountUserMax: 25,
    })
    expect(findMetric(metrics, "STOCK_COUNT").status).toBe("RED")
  })
})

describe("evaluateConstraintMetrics — en yüksek tek hisse ağırlığı", () => {
  it("%9'un altı yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSingleStockWeight: 8,
    })
    expect(findMetric(metrics, "MAX_SINGLE_STOCK_WEIGHT").status).toBe("GREEN")
  })

  it("limite 1 puan yaklaşınca (9-10) amber", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSingleStockWeight: 9.5,
    })
    expect(findMetric(metrics, "MAX_SINGLE_STOCK_WEIGHT").status).toBe("AMBER")
  })

  it("%10'u aşınca kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSingleStockWeight: 10.5,
    })
    expect(findMetric(metrics, "MAX_SINGLE_STOCK_WEIGHT").status).toBe("RED")
  })
})

describe("evaluateConstraintMetrics — en yüksek sektör yoğunlaşması", () => {
  it("%27 ve altı yeşil", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: 27,
    })
    expect(findMetric(metrics, "MAX_SECTOR_CONCENTRATION").status).toBe("GREEN")
  })

  it("%27-30 arası amber", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: 29,
    })
    expect(findMetric(metrics, "MAX_SECTOR_CONCENTRATION").status).toBe("AMBER")
  })

  it("%30'u aşınca kırmızı", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: 31,
    })
    expect(findMetric(metrics, "MAX_SECTOR_CONCENTRATION").status).toBe("RED")
  })
})

describe("evaluateConstraintMetrics — veri yok (kontrol edilemedi)", () => {
  it("değer null ise gri/kontrol edilemedi döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: null,
    })
    expect(findMetric(metrics, "MAX_SECTOR_CONCENTRATION").status).toBe("GRAY")
  })

  it("toplam hisse ağırlığı null ise gri döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      totalEquityWeight: null,
    })
    expect(findMetric(metrics, "TOTAL_EQUITY_WEIGHT").status).toBe("GRAY")
  })

  it("TPP ağırlığı null ise gri döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      tppWeight: null,
    })
    expect(findMetric(metrics, "TPP_WEIGHT").status).toBe("GRAY")
  })

  it("hisse sayısı null ise gri döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      stockCount: null,
    })
    expect(findMetric(metrics, "STOCK_COUNT").status).toBe("GRAY")
  })

  it("en yüksek tek hisse null ise gri döner", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSingleStockWeight: null,
    })
    expect(findMetric(metrics, "MAX_SINGLE_STOCK_WEIGHT").status).toBe("GRAY")
  })
})

describe("isApprovalBlockedByConstraints", () => {
  it("tüm kısıt metrikleri yeşil/amber ise onayı engellemez", () => {
    const metrics = evaluateConstraintMetrics(BASE_CONSTRAINT_INPUT)
    expect(isApprovalBlockedByConstraints(metrics)).toBe(false)
  })

  it("en az bir kısıt metriği kırmızıysa onayı engeller", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: 35,
    })
    expect(isApprovalBlockedByConstraints(metrics)).toBe(true)
  })

  it("kontrol edilemedi (gri) durumu tek başına onayı engellemez", () => {
    const metrics = evaluateConstraintMetrics({
      ...BASE_CONSTRAINT_INPUT,
      maxSectorConcentration: null,
    })
    expect(isApprovalBlockedByConstraints(metrics)).toBe(false)
  })
})

const RISK_METRICS_BASE: PortfolioRiskMetricsSnapshot = {
  beta: 1,
  volatility: 18,
  maxDrawdown: -20,
  downsideDeviation: 12,
  trackingError: 3,
  sharpeRatio: 0.9,
  calmarRatio: 0.4,
  informationRatio: 0.3,
  alpha: 1,
}

function findInfoMetric(
  metrics: ReturnType<typeof evaluateInfoMetrics>,
  key: string,
) {
  const metric = metrics.find((item) => item.key === key)
  if (!metric) throw new Error(`metric not found: ${key}`)
  return metric
}

describe("evaluateInfoMetrics — risk seviyesi metrikleri (beta/volatilite/downside deviation)", () => {
  it("azaldıysa yeşil", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 0.8 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("GREEN")
  })

  it("Dengeli profilde eşiğin (0.5) altında artış yeşil kalır", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 1.3 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("GREEN")
  })

  it("Dengeli profilde eşiğin (0.5) üstünde artış amber", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 1.6 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("AMBER")
  })

  it("Korumacı profilde eşik 0.2 puana sıkılaşır", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 1.3 },
      "CONSERVATIVE",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("AMBER")
  })

  it("Atak profilde risk artışı Sharpe düşmüyorsa yeşil (olağan)", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 1.8, sharpeRatio: 1.1 },
      "AGGRESSIVE",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("GREEN")
  })

  it("Atak profilde risk artışı Sharpe de düşüyorsa amber", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 1.8, sharpeRatio: 0.5 },
      "AGGRESSIVE",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("AMBER")
  })

  it("hiçbir zaman kırmızı döndürmez", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, beta: 5, volatility: 90 },
      "CONSERVATIVE",
    )
    expect(metrics.every((metric) => metric.status as string !== "RED")).toBe(
      true,
    )
  })
})

describe("evaluateInfoMetrics — maksimum düşüş", () => {
  it("sığlaştıysa yeşil", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, maxDrawdown: -15 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "MAX_DRAWDOWN").status).toBe("GREEN")
  })

  it("1 puandan fazla derinleştiyse amber", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, maxDrawdown: -22 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "MAX_DRAWDOWN").status).toBe("AMBER")
  })

  it("1 puan veya altı derinleşme yeşil kalır", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, maxDrawdown: -20.5 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "MAX_DRAWDOWN").status).toBe("GREEN")
  })
})

describe("evaluateInfoMetrics — Sharpe/Calmar/IR/Alfa", () => {
  it("arttıysa yeşil", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, sharpeRatio: 1.2 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "SHARPE_RATIO").status).toBe("GREEN")
  })

  it("düştüyse amber", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, sharpeRatio: 0.5 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "SHARPE_RATIO").status).toBe("AMBER")
  })
})

describe("evaluateInfoMetrics — tracking error", () => {
  it("her zaman nötr, amaca bağlı yorumlanır", () => {
    const metrics = evaluateInfoMetrics(
      RISK_METRICS_BASE,
      { ...RISK_METRICS_BASE, trackingError: 10 },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "TRACKING_ERROR").status).toBe("NEUTRAL")
  })
})

describe("evaluateInfoMetrics — eksik veri", () => {
  it("değer null ise nötr döner", () => {
    const metrics = evaluateInfoMetrics(
      { ...RISK_METRICS_BASE, beta: null },
      { ...RISK_METRICS_BASE, beta: null },
      "BALANCED",
    )
    expect(findInfoMetric(metrics, "BETA").status).toBe("NEUTRAL")
  })
})
