import type { UserRole, UserStatus } from "@/features/users/model/user.types"

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Admin"
    case "COMPANY_MANAGER":
      return "Company Manager"
    case "USER":
      return "Kullanıcı"
  }
}

export function formatStatusLabel(status: UserStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif"
    case "INACTIVE":
      return "Pasif"
    case "LOCKED":
      return "Kilitli"
  }
}

export function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
