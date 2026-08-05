type PortfolioSizeLimits = {
  minInitialPortfolioSize: number
  maxInitialPortfolioSize: number
}

const amountFormatter = new Intl.NumberFormat("tr-TR")

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "")
}

export function parsePortfolioSize(raw: string): number | null {
  const digits = digitsOnly(raw)
  if (!digits) return null

  const value = Number(digits)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function formatPortfolioSize(value: number | string): string {
  const digits = typeof value === "number" ? String(value) : digitsOnly(value)
  if (!digits) return ""

  return amountFormatter.format(Number(digits))
}

export function limitBarPosition(
  raw: string,
  limits: PortfolioSizeLimits,
): number | null {
  const value = parsePortfolioSize(raw)
  if (value == null) return null

  const { minInitialPortfolioSize: min, maxInitialPortfolioSize: max } = limits
  if (max <= min) return 0
  if (value <= min) return 0
  if (value >= max) return 1

  const start = Math.log(min)
  const end = Math.log(max)
  return (Math.log(value) - start) / (end - start)
}

export function isPortfolioSizeReady(
  raw: string,
  limits: PortfolioSizeLimits | null,
): boolean {
  if (!limits) return false

  const value = parsePortfolioSize(raw)
  return (
    value != null &&
    value >= limits.minInitialPortfolioSize &&
    value <= limits.maxInitialPortfolioSize
  )
}
