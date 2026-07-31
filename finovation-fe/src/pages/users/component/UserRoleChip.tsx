import type { UserRole } from "@/type/user.types"
import { formatRoleLabel } from "@/util/userLabels"
import styles from "@/pages/users/css/UserRoleChip.module.css"

type UserRoleChipProps = {
  role: UserRole
}

export default function UserRoleChip({ role }: UserRoleChipProps) {
  const toneClass =
    role === "SUPER_ADMIN"
      ? styles.superAdmin
      : role === "ADMIN"
        ? styles.admin
        : styles.user

  return (
    <span className={`${styles.chip} ${toneClass}`}>{formatRoleLabel(role)}</span>
  )
}
