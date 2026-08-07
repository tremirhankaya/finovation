import { z } from "zod"

export const userRoleSchema = z.enum(["USER", "COMPANY_MANAGER", "ADMIN"])
export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "LOCKED"])

export type UserRole = z.infer<typeof userRoleSchema>
export type UserStatus = z.infer<typeof userStatusSchema>
