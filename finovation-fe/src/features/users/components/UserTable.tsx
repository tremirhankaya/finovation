import UserRoleChip from "@/features/users/components/UserRoleChip"
import UserStatusChip from "@/features/users/components/UserStatusChip"
import type { UserListItem, UserRole } from "@/features/users/model/user.types"
import { formatCreatedAt } from "@/features/users/lib/userLabels"
import styles from "@/features/users/styles/UserTable.module.css"

const SKELETON_ROWS = 4

type UserTableProps = {
  users: UserListItem[]
  isLoading: boolean
  hasActiveFilters: boolean
  assignableRoles: UserRole[]
  deletableRoles: UserRole[]
  currentUserId: number | null
  onClearFilters: () => void
  onEdit: (userId: number) => void
  onDelete: (userId: number) => void
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function TableHead() {
  return (
    <thead>
      <tr>
        <th scope="col">Kullanıcı adı</th>
        <th scope="col">Ad soyad</th>
        <th scope="col">Şirket</th>
        <th scope="col">Rol</th>
        <th scope="col">Durum</th>
        <th scope="col">Kayıt tarihi</th>
        <th scope="col" className={styles.actionsHead}>
          İşlemler
        </th>
      </tr>
    </thead>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <tr key={index} className={styles.skeletonRow} aria-hidden="true">
          <td>
            <span className={`${styles.skeletonBar} ${styles.barSm}`} />
          </td>
          <td>
            <span className={`${styles.skeletonBar} ${styles.barMd}`} />
          </td>
          <td>
            <span className={`${styles.skeletonBar} ${styles.barMd}`} />
          </td>
          <td>
            <span className={`${styles.skeletonBar} ${styles.barChip}`} />
          </td>
          <td>
            <span className={`${styles.skeletonBar} ${styles.barChip}`} />
          </td>
          <td>
            <span className={`${styles.skeletonBar} ${styles.barSm}`} />
          </td>
          <td>
            <div className={styles.skeletonActions}>
              <span className={`${styles.skeletonBar} ${styles.barBtn}`} />
              <span className={`${styles.skeletonBar} ${styles.barIcon}`} />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

export default function UserTable({
  users,
  isLoading,
  hasActiveFilters,
  assignableRoles,
  deletableRoles,
  currentUserId,
  onClearFilters,
  onEdit,
  onDelete,
}: UserTableProps) {
  if (!isLoading && users.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          {hasActiveFilters
            ? "Bu filtrelere uygun kullanıcı yok"
            : "Kayıt bulunamadı."}
        </p>
        {hasActiveFilters && (
          <button
            className={styles.clearLink}
            type="button"
            onClick={onClearFilters}
          >
            Filtreleri temizle
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <TableHead />
        <tbody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            users.map((user) => (
              <tr key={user.id}>
                <td className={styles.username}>{user.username}</td>
                <td>{user.fullName}</td>
                <td>{user.companyName?.trim() || "—"}</td>
                <td>
                  <UserRoleChip role={user.role} />
                </td>
                <td>
                  <UserStatusChip status={user.status} />
                </td>
                <td>{formatCreatedAt(user.createdAt)}</td>
                <td>
                  <div className={styles.actions}>
                    {(assignableRoles.includes(user.role) ||
                      user.id === currentUserId) && (
                      <button
                        className={styles.editButton}
                        type="button"
                        aria-label={`${user.username} düzenle`}
                        onClick={() => onEdit(user.id)}
                      >
                        Düzenle
                      </button>
                    )}
                    {deletableRoles.includes(user.role) && (
                      <button
                        className={styles.deleteButton}
                        type="button"
                        aria-label={`${user.username} sil`}
                        title="Sil"
                        onClick={() => onDelete(user.id)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
