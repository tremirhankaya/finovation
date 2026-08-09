export const RISK_PROFILE_LABELS: Record<string, string> = {
  AGGRESSIVE: "Agresif",
  BALANCED: "Dengeli",
  CONSERVATIVE: "Korumacı",
}

export const CONSTRAINT_STATUS_LABELS: Record<string, string> = {
  GREEN: "Uyumlu",
  AMBER: "Sınıra Yakın",
  RED: "İhlal Var",
  GRAY: "Kontrol Edilemedi",
}

export const INFO_STATUS_LABELS: Record<string, string> = {
  GREEN: "Uyumlu",
  AMBER: "Sınıra Yakın",
  NEUTRAL: "Kontrol Edilemedi",
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  INCREASE: "Artırıldı",
  DECREASE: "Azaltıldı",
  KEEP: "Korundu",
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString("tr-TR")
}
