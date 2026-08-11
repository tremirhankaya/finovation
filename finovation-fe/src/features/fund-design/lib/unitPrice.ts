type UnitPriceLimits = {
  minUnitPrice: number
  maxUnitPrice: number
}

function normalizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "")
  const firstComma = cleaned.indexOf(",")
  if (firstComma === -1) return cleaned

  return (
    cleaned.slice(0, firstComma + 1) +
    cleaned.slice(firstComma + 1).replace(/,/g, "")
  )
}

export function parseUnitPrice(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw)
  if (!normalized || normalized === ",") return null

  const value = Number(normalized.replace(",", "."))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function formatUnitPrice(raw: string): string {
  const normalized = normalizeDecimalInput(raw)
  if (!normalized) return ""

  const [whole = "", fraction] = normalized.split(",")
  const wholeDigits = whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  const safeWhole =
    wholeDigits || (fraction != null || normalized.endsWith(",") ? "0" : "")

  if (!safeWhole && fraction == null) return ""

  if (fraction == null && !normalized.endsWith(",")) {
    return safeWhole
  }

  const fractionDigits = (fraction ?? "").replace(/\D/g, "").slice(0, 4)
  if (normalized.endsWith(",") && fractionDigits.length === 0) {
    return `${safeWhole},`
  }

  return `${safeWhole},${fractionDigits}`
}

export function isUnitPriceReady(
  raw: string,
  limits: UnitPriceLimits | null,
): boolean {
  if (!limits) return false

  const value = parseUnitPrice(raw)
  return (
    value != null &&
    value >= limits.minUnitPrice &&
    value <= limits.maxUnitPrice
  )
}
