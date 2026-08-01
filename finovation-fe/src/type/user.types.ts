export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN"
export type UserStatus = "ACTIVE" | "INACTIVE"

export type UserListItem = {
  id: number
  username: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  companyId: number | null
  companyName: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
}

export type UpdateUserPayload = {
  firstName: string
  lastName: string
  email: string
  password?: string
  role: UserRole
  status: UserStatus
  companyId?: number | null
}

export type CreateUserPayload = {
  username: string
  firstName: string
  lastName: string
  email: string
  password: string
  role: UserRole
  companyId?: number | null
}

export type UserDetail = {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  status: UserStatus
  companyId: number | null
  companyName: string | null
  createdAt: string
}

export type UserPageResponse = {
  content: UserListItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export type GetUsersParams = {
  page?: number
  size?: number
  q?: string
  role?: UserRole
  status?: UserStatus
  companyId?: number | null
  createdFrom?: string
  createdTo?: string
}

export type UserListFilters = {
  q: string
  role: "" | UserRole
  status: "" | UserStatus
  companyId: number | null
  createdFrom: string
  createdTo: string
}
