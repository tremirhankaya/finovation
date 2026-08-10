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
  NEUTRAL: "Bilgi",
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  INCREASE: "Artırıldı",
  DECREASE: "Azaltıldı",
  KEEP: "Korundu",
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PREPARING: "Hazırlanıyor",
  RUNNING: "Çalışıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString("tr-TR")
}

const DECIDED_STATUSES = new Set(["APPROVED", "REJECTED"])

export function formatDecisionDateTime(
  status: string,
  updatedAt: string | null,
): string {
  if (!DECIDED_STATUSES.has(status)) return "—"
  return formatDateTime(updatedAt)
}
