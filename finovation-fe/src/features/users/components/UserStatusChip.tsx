import type { UserStatus } from "@/features/users/model/user.types"
import { formatStatusLabel } from "@/features/users/lib/userLabels"
import styles from "@/features/users/styles/UserStatusChip.module.css"

type UserStatusChipProps = {
  status: UserStatus
}

export default function UserStatusChip({ status }: UserStatusChipProps) {
  const toneClass =
    status === "ACTIVE"
      ? styles.active
      : status === "LOCKED"
        ? styles.locked
        : styles.inactive

  return (
    <span className={`${styles.chip} ${toneClass}`}>
      {formatStatusLabel(status)}
    </span>
  )
}
