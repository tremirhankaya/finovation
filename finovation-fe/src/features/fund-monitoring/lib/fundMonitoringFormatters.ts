import type {
  IndicatorUnit,
  TechnicalIndicator,
} from "@/features/fund-monitoring/model/fundMonitoring.types"

const numberFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPercentage(value: number | null): string {
  if (value === null) return "—"

  const sign = value > 0 ? "+" : ""
  return `${sign}%${numberFormatter.format(value)}`
}

export function formatSharePrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value)
  } catch {
    return `${numberFormatter.format(value)} ${currency}`
  }
}

export function formatIndicatorValue(
  value: number | null,
  unit: IndicatorUnit,
): string {
  if (value === null) return "—"
  return unit === "PERCENT"
    ? `%${numberFormatter.format(value)}`
    : numberFormatter.format(value)
}

export function indicatorToneClass(
  indicator: TechnicalIndicator,
): "positive" | "negative" | "neutral" {
  return indicator.tone ?? "neutral"
}

export function formatDataDate(value?: string): string {
  if (!value) return "Veri tarihi bekleniyor"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Veri tarihi bekleniyor"

  return `Veri tarihi: ${new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)}`
}
