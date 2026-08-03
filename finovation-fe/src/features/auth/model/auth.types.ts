import type { UserRole, UserStatus } from "@/shared/model/userIdentity"

export type LoginResponse = {
  accessToken: string
  refreshToken: string
}

export type MeResponse = {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  status: UserStatus
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
