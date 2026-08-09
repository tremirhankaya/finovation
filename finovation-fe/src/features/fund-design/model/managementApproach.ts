export type ManagementApproachCode = "ATTACK" | "BALANCED" | "PROTECTIVE"

export type ManagementApproachOption = {
  code: ManagementApproachCode
  label: string
  description: string
  defaultLiquidityMinPct: number
  defaultLiquidityMaxPct: number
  defaultPreferredLiquidityPct: number
  defaultMinStockCount: number
  defaultMaxStockCount: number
}

export const MANAGEMENT_APPROACHES: ManagementApproachOption[] = [
  {
    code: "PROTECTIVE",
    label: "Korumacı",
    description:
      "Düşük risk profili ile sermaye korumasına öncelik verir.",
    defaultLiquidityMinPct: 10,
    defaultLiquidityMaxPct: 15,
    defaultPreferredLiquidityPct: 12,
    defaultMinStockCount: 16,
    defaultMaxStockCount: 21,
  },
  {
    code: "BALANCED",
    label: "Dengeli",
    description:
      "Fırsat ve istikrar arasında dengeli bir yönetim yaklaşımı sunar.",
    defaultLiquidityMinPct: 8,
    defaultLiquidityMaxPct: 12,
    defaultPreferredLiquidityPct: 10,
    defaultMinStockCount: 21,
    defaultMaxStockCount: 26,
  },
  {
    code: "ATTACK",
    label: "Agresif",
    description:
      "Yüksek risk ve getiri potansiyeli ile piyasa fırsatlarına odaklanır.",
    defaultLiquidityMinPct: 5,
    defaultLiquidityMaxPct: 10,
    defaultPreferredLiquidityPct: 8,
    defaultMinStockCount: 25,
    defaultMaxStockCount: 30,
  },
]

export function getManagementApproach(
  code: ManagementApproachCode,
): ManagementApproachOption {
  return (
    MANAGEMENT_APPROACHES.find((item) => item.code === code) ??
    MANAGEMENT_APPROACHES[0]
  )
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampRange(
  valueMin: number,
  valueMax: number,
  boundMin: number,
  boundMax: number,
  minGap: number,
): { min: number; max: number } {
  const gap = Math.max(minGap, 0)
  let nextMin = clampToRange(valueMin, boundMin, boundMax)
  let nextMax = clampToRange(valueMax, boundMin, boundMax)

  if (nextMax - nextMin < gap) {
    nextMax = Math.min(boundMax, nextMin + gap)
    if (nextMax - nextMin < gap) {
      nextMin = Math.max(boundMin, nextMax - gap)
    }
  }

  return { min: nextMin, max: nextMax }
}
