import type { UserStatus } from "@/type/user.types"
import { formatStatusLabel } from "@/util/userLabels"
import styles from "@/pages/users/css/UserStatusChip.module.css"

type UserStatusChipProps = {
  status: UserStatus
}

export default function UserStatusChip({ status }: UserStatusChipProps) {
  const toneClass = status === "ACTIVE" ? styles.active : styles.inactive

  return (
    <span className={`${styles.chip} ${toneClass}`}>
      {formatStatusLabel(status)}
    </span>
  )
}
