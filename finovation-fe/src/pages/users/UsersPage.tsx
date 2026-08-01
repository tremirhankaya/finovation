import { useState } from "react"

import FormAlert from "@/component/FormAlert"
import { useAuth } from "@/context/AuthContext"
import UserDeleteConfirm from "@/pages/users/component/UserDeleteConfirm"
import UserEditModal from "@/pages/users/component/UserEditModal"
import UserErrorDialog from "@/pages/users/component/UserErrorDialog"
import UserPagination from "@/pages/users/component/UserPagination"
import UserSearchToolbar from "@/pages/users/component/UserSearchToolbar"
import UserTable from "@/pages/users/component/UserTable"
import { useCompanyOptions } from "@/pages/users/hook/useCompanyOptions"
import { useUsersList } from "@/pages/users/hook/useUsersList"
import { deleteUser, updateUser } from "@/service/userService"
import type { UpdateUserPayload, UserListFilters } from "@/type/user.types"
import { isPermissionError } from "@/util/apiError"
import styles from "@/pages/users/css/UsersPage.module.css"

const PERMISSION_ERROR_MESSAGE = "Bu işlem için yetkiniz yok."
const PAGE_SIZE = 10

const EMPTY_FILTERS: UserListFilters = {
  q: "",
  role: "",
  status: "",
  companyId: null,
  createdFrom: "",
  createdTo: "",
}

export default function UsersPage() {
  const { user } = useAuth()
  const canCreateUser = user?.canCreateUser ?? false
  const assignableRoles = user?.assignableRoles ?? []
  const deletableRoles = user?.deletableRoles ?? []

  const [queryInput, setQueryInput] = useState("")
  const [filters, setFilters] = useState<UserListFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [editError, setEditError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [permissionError, setPermissionError] = useState("")

  const { companies, error: companiesError } = useCompanyOptions()
  const {
    users,
    totalPages,
    totalElements,
    hasNext,
    hasPrevious,
    isLoading,
    error,
    reload,
  } = useUsersList({ filters, page, pageSize: PAGE_SIZE })

  const hasActiveFilters =
    filters.q !== "" ||
    filters.role !== "" ||
    filters.status !== "" ||
    filters.companyId !== null ||
    filters.createdFrom !== "" ||
    filters.createdTo !== ""

  const editingUser =
    editingUserId === null
      ? null
      : (users.find((item) => item.id === editingUserId) ?? null)

  const deletingUser =
    deletingUserId === null
      ? null
      : (users.find((item) => item.id === deletingUserId) ?? null)

  const applyFilters = (next: UserListFilters) => {
    setFilters(next)
    setQueryInput(next.q)
    setPage(0)
  }

  const handleSearch = () => {
    applyFilters({
      ...filters,
      q: queryInput.trim(),
    })
  }

  const closeEditor = () => {
    setEditingUserId(null)
    setEditError("")
  }

  const closeDeleteConfirm = () => {
    setDeletingUserId(null)
  }

  const handleMutationError = (
    mutationError: unknown,
    fallback: string,
    options?: { forEdit?: boolean },
  ) => {
    if (isPermissionError(mutationError)) {
      closeEditor()
      closeDeleteConfirm()
      setPermissionError(PERMISSION_ERROR_MESSAGE)
      return
    }

    if (options?.forEdit) {
      setEditError(
        mutationError instanceof Error ? mutationError.message : fallback,
      )
    } else {
      setPermissionError(
        mutationError instanceof Error ? mutationError.message : fallback,
      )
      closeDeleteConfirm()
    }
  }

  const handleSave = async (payload: UpdateUserPayload) => {
    if (editingUserId === null) {
      return
    }

    setIsSaving(true)
    setEditError("")
    setPermissionError("")

    try {
      await updateUser(editingUserId, payload)
      closeEditor()
      reload()
    } catch (saveError) {
      handleMutationError(saveError, "Kullanıcı güncellenemedi.", {
        forEdit: true,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deletingUserId === null) {
      return
    }

    setIsDeleting(true)
    setPermissionError("")

    try {
      await deleteUser(deletingUserId)
      closeDeleteConfirm()
      reload()
    } catch (deleteError) {
      handleMutationError(deleteError, "Kullanıcı silinemedi.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <header className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Kullanıcılar</h1>
            <p className={styles.desc}>Kullanıcı yönetim paneli.</p>
          </div>
          {canCreateUser && (
            <button
              className={styles.createButton}
              type="button"
              disabled
              title="Yakında eklenecek"
            >
              + Yeni kullanıcı
            </button>
          )}
        </header>

        {error && (
          <div className={styles.pageAlert}>
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        {!error && companiesError && (
          <div className={styles.pageAlert}>
            <FormAlert>
              Şirket filtresi kullanılamıyor: {companiesError}
            </FormAlert>
          </div>
        )}

        <section className={styles.card}>
          <UserSearchToolbar
            query={queryInput}
            filters={filters}
            companies={companies}
            onQueryChange={setQueryInput}
            onSearch={handleSearch}
            onApplyFilters={applyFilters}
          />

          <UserTable
            users={users}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            assignableRoles={assignableRoles}
            deletableRoles={deletableRoles}
            onClearFilters={() => applyFilters(EMPTY_FILTERS)}
            onEdit={(userId) => {
              setEditError("")
              setEditingUserId(userId)
            }}
            onDelete={(userId) => {
              setDeletingUserId(userId)
            }}
          />

          <UserPagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() =>
              setPage((current) => (hasNext ? current + 1 : current))
            }
          />
        </section>
      </div>

      <UserEditModal
        open={editingUser !== null}
        user={editingUser}
        isSaving={isSaving}
        error={editError}
        onClose={() => {
          if (isSaving) {
            return
          }
          closeEditor()
        }}
        onSave={handleSave}
      />

      <UserDeleteConfirm
        open={deletingUser !== null}
        username={deletingUser?.username ?? ""}
        isDeleting={isDeleting}
        onCancel={() => {
          if (isDeleting) {
            return
          }
          closeDeleteConfirm()
        }}
        onConfirm={() => {
          void handleDelete()
        }}
      />

      <UserErrorDialog
        open={permissionError !== ""}
        message={permissionError}
        onClose={() => setPermissionError("")}
      />
    </div>
  )
}
