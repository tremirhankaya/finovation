import { useCallback, useEffect, useState } from "react"

import { getUsers } from "@/features/users/api/userService"
import type {
  UserListFilters,
  UserListItem,
} from "@/features/users/model/user.types"

type UseUsersListParams = {
  filters: UserListFilters
  page: number
  pageSize: number
}

type UsersListPage = {
  users: UserListItem[]
  totalPages: number
  totalElements: number
  hasNext: boolean
  hasPrevious: boolean
}

export type UseUsersListResult = UsersListPage & {
  isLoading: boolean
  error: string
  reload: () => void
}

const EMPTY_PAGE: UsersListPage = {
  users: [],
  totalPages: 0,
  totalElements: 0,
  hasNext: false,
  hasPrevious: false,
}

export function useUsersList({
  filters,
  page,
  pageSize,
}: UseUsersListParams): UseUsersListResult {
  const [currentPage, setCurrentPage] = useState<UsersListPage>(EMPTY_PAGE)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    setIsLoading(true)
    setError("")

    void (async () => {
      try {
        const response = await getUsers(
          {
            page,
            size: pageSize,
            q: filters.q || undefined,
            role: filters.role || undefined,
            status: filters.status || undefined,
            companyId: filters.companyId,
            createdFrom: filters.createdFrom || undefined,
            createdTo: filters.createdTo || undefined,
          },
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setCurrentPage({
          users: response.content,
          totalPages: response.totalPages,
          totalElements: response.totalElements,
          hasNext: response.hasNext,
          hasPrevious: response.hasPrevious,
        })
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setCurrentPage(EMPTY_PAGE)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Kullanıcı listesi alınamadı.",
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [
    filters.companyId,
    filters.createdFrom,
    filters.createdTo,
    filters.q,
    filters.role,
    filters.status,
    page,
    pageSize,
    reloadKey,
  ])

  return { ...currentPage, isLoading, error, reload }
}
