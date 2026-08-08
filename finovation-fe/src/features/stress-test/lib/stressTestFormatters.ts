export function formatStressPercentage(value: number): string {
    const percentage = value * 100
    const sign = percentage > 0 ? "+" : ""

    return `${sign}${percentage.toFixed(2)}%`
}

export function formatStressWeight(value: number): string {
    return `${value.toFixed(2)}%`
}

export function formatStressDate(value: string): string {
    const [year, month, day] = value.split("-")

    if (!year || !month || !day) return value

    return `${day}.${month}.${year}`
}