import styles from "@/pages/users/css/UserPagination.module.css"

type UserPaginationProps = {
  page: number
  totalPages: number
  totalElements: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
}

export default function UserPagination({
  page,
  totalPages,
  totalElements,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: UserPaginationProps) {
  return (
    <div className={styles.pager}>
      <p className={styles.total} aria-live="polite">
        {totalElements} kullanıcı
      </p>
      <div className={styles.right}>
        <button
          className={styles.pageButton}
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          Önceki
        </button>
        <span>
          Sayfa {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <button
          className={styles.pageButton}
          type="button"
          onClick={onNext}
          disabled={!hasNext}
        >
          Sonraki
        </button>
      </div>
    </div>
  )
}
