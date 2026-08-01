import type { UserRole } from "@/type/user.types"

export type AuthUser = {
  id?: string | number
  username?: string
  displayName?: string
  roles?: string[]
}

export type LoginResponse = {
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  user?: AuthUser
}

export type MeResponse = {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  status: "ACTIVE" | "INACTIVE"
  passwordChangeRequired: boolean
  companyId: number | null
  companyName: string | null
  canAccessPanel: boolean
  canCreateUser: boolean
  canDeleteUser: boolean
  assignableRoles: UserRole[]
  deletableRoles: UserRole[]
}

export type PasswordResetVerifyResponse = {
  resetToken: string
}
