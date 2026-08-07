import type { UserRole } from "@/features/users/model/user.types"
import { formatRoleLabel } from "@/features/users/lib/userLabels"
import styles from "@/features/users/styles/UserRoleChip.module.css"

type UserRoleChipProps = {
  role: UserRole
}

export default function UserRoleChip({ role }: UserRoleChipProps) {
  const toneClass =
    role === "ADMIN"
      ? styles.admin
      : role === "COMPANY_MANAGER"
        ? styles.admin
        : styles.user

  return (
    <span className={`${styles.chip} ${toneClass}`}>
      {formatRoleLabel(role)}
    </span>
  )
}
