import { useEffect, useState } from "react"

import FormAlert from "@/shared/ui/FormAlert"
import { useAuth } from "@/features/auth/context/AuthContext"
import UserCreateModal from "@/features/users/components/UserCreateModal"
import UserDeleteConfirm from "@/features/users/components/UserDeleteConfirm"
import UserEditModal from "@/features/users/components/UserEditModal"
import UserErrorDialog from "@/features/users/components/UserErrorDialog"
import UserPagination from "@/features/users/components/UserPagination"
import UserSearchToolbar from "@/features/users/components/UserSearchToolbar"
import UserTable from "@/features/users/components/UserTable"
import { useCompanyOptions } from "@/features/users/hooks/useCompanyOptions"
import { useUsersList } from "@/features/users/hooks/useUsersList"
import {
  createUser,
  deleteUser,
  updateUser,
} from "@/features/users/api/userService"
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserListFilters,
} from "@/features/users/model/user.types"
import { isPermissionError } from "@/shared/api/apiError"
import styles from "@/features/users/styles/UsersPage.module.css"

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
  const [editError, setEditError] = useState<Error | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [permissionError, setPermissionError] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<Error | null>(null)

  const {
    companies,
    error: companiesError,
    isLoading: companiesLoading,
    reload: reloadCompanies,
  } = useCompanyOptions()
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

  useEffect(() => {
    if (isLoading) return

    const lastValidPage = Math.max(0, totalPages - 1)
    if (page > lastValidPage) {
      setPage(lastValidPage)
    }
  }, [isLoading, page, totalPages])

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
    setEditError(null)
  }

  const closeDeleteConfirm = () => {
    setDeletingUserId(null)
  }

  const closeCreateModal = () => {
    setIsCreateOpen(false)
    setCreateError(null)
  }

  const handleMutationError = (
    mutationError: unknown,
    fallback: string,
    options?: {
      forEdit?: boolean
      forCreate?: boolean
    },
  ) => {
    if (isPermissionError(mutationError)) {
      closeEditor()
      closeCreateModal()
      closeDeleteConfirm()
      setPermissionError(PERMISSION_ERROR_MESSAGE)
      return
    }

    if (options?.forEdit) {
      setEditError(
        mutationError instanceof Error ? mutationError : new Error(fallback),
      )
    } else if (options?.forCreate) {
      setCreateError(
        mutationError instanceof Error ? mutationError : new Error(fallback),
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
    setEditError(null)
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

  const handleCreateUser = async (payload: CreateUserPayload) => {
    setIsCreating(true)
    setCreateError(null)
    setPermissionError("")

    try {
      await createUser(payload)
      closeCreateModal()
      if (page === 0) {
        reload()
      } else {
        setPage(0)
      }
    } catch (createErr) {
      handleMutationError(createErr, "Kullanıcı oluşturulamadı.", {
        forCreate: true,
      })
    } finally {
      setIsCreating(false)
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
      if (users.length === 1 && page > 0) {
        setPage((current) => current - 1)
      } else {
        reload()
      }
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
              onClick={() => setIsCreateOpen(true)}
            >
              + Yeni kullanıcı
            </button>
          )}
        </header>

        {error && (
          <div className={styles.pageAlert}>
            <FormAlert>
              {error}
              <button
                className={styles.alertAction}
                type="button"
                onClick={reload}
              >
                Tekrar dene
              </button>
            </FormAlert>
          </div>
        )}

        {!error && companiesError && (
          <div className={styles.pageAlert}>
            <FormAlert>
              Şirket filtresi kullanılamıyor: {companiesError}
              <button
                className={styles.alertAction}
                type="button"
                onClick={reloadCompanies}
              >
                Tekrar dene
              </button>
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

          {!error && (
            <>
              <UserTable
                users={users}
                isLoading={isLoading}
                hasActiveFilters={hasActiveFilters}
                assignableRoles={assignableRoles}
                deletableRoles={deletableRoles}
                currentUserId={user?.id ?? null}
                onClearFilters={() => applyFilters(EMPTY_FILTERS)}
                onEdit={(userId) => {
                  setEditError(null)
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
                onPrevious={() =>
                  setPage((current) => Math.max(0, current - 1))
                }
                onNext={() =>
                  setPage((current) => (hasNext ? current + 1 : current))
                }
              />
            </>
          )}
        </section>
      </div>

      <UserEditModal
        open={editingUser !== null}
        user={editingUser}
        isSaving={isSaving}
        error={editError}
        currentUserId={user?.id ?? null}
        actorRole={user?.role ?? "USER"}
        assignableRoles={assignableRoles}
        companies={companies}
        companiesLoading={companiesLoading}
        companiesError={companiesError}
        onRetryCompanies={reloadCompanies}
        onErrorDismiss={() => setEditError(null)}
        onClose={() => {
          if (isSaving) {
            return
          }
          closeEditor()
        }}
        onSave={handleSave}
      />

      <UserCreateModal
        open={isCreateOpen}
        isSaving={isCreating}
        error={createError}
        assignableRoles={assignableRoles}
        companies={companies}
        companiesLoading={companiesLoading}
        companiesError={companiesError}
        onRetryCompanies={reloadCompanies}
        actorRole={user?.role ?? "USER"}
        onErrorDismiss={() => setCreateError(null)}
        onClose={() => {
          if (isCreating) {
            return
          }
          closeCreateModal()
        }}
        onCreate={handleCreateUser}
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
