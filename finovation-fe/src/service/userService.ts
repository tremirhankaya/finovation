import { getUsersUrl } from "@/config/api"
import { apiFetch, apiSend } from "@/service/httpClient"
import type {
  CreateUserPayload,
  GetUsersParams,
  UpdateUserPayload,
  UserDetail,
  UserPageResponse,
} from "@/type/user.types"

function buildListQuery(params: GetUsersParams): URLSearchParams {
  const searchParams = new URLSearchParams()
  searchParams.set("page", String(params.page ?? 0))
  searchParams.set("size", String(params.size ?? 10))

  const query = params.q?.trim()
  if (query) {
    searchParams.set("q", query)
  }

  if (params.role) {
    searchParams.set("role", params.role)
  }

  if (params.status) {
    searchParams.set("status", params.status)
  }

  if (params.companyId != null) {
    searchParams.set("companyId", String(params.companyId))
  }

  if (params.createdFrom) {
    searchParams.set("createdFrom", params.createdFrom)
  }

  if (params.createdTo) {
    searchParams.set("createdTo", params.createdTo)
  }

  return searchParams
}

export async function getUsers(
  params: GetUsersParams = {},
  signal?: AbortSignal,
): Promise<UserPageResponse> {
  return apiFetch<UserPageResponse>(
    `${getUsersUrl()}?${buildListQuery(params)}`,
    {
      errorMessage: "Kullanıcı listesi alınamadı",
      signal,
    },
  )
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<UserDetail> {
  return apiFetch<UserDetail>(getUsersUrl(), {
    method: "POST",
    body: {
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      companyId: payload.companyId ?? null,
    },
    errorMessage: "Kullanıcı oluşturulamadı",
  })
}

export async function updateUser(
  userId: number,
  payload: UpdateUserPayload,
): Promise<UserDetail> {
  const body: Record<string, unknown> = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    role: payload.role,
    status: payload.status,
    companyId: payload.companyId ?? null,
  }

  if (payload.password && payload.password.trim()) {
    body.password = payload.password.trim()
  }

  return apiFetch<UserDetail>(getUsersUrl(userId), {
    method: "PUT",
    body,
    errorMessage: "Kullanıcı güncellenemedi",
  })
}

export async function deleteUser(userId: number): Promise<void> {
  await apiSend(getUsersUrl(userId), {
    method: "DELETE",
    errorMessage: "Kullanıcı silinemedi",
  })
}
