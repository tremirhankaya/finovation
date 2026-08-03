import { z } from "zod"

import { userRoleSchema, userStatusSchema } from "@/shared/model/userIdentity"

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
})

export const meResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  passwordChangeRequired: z.boolean(),
  companyId: z.number().nullable(),
  companyName: z.string().nullable(),
  canAccessPanel: z.boolean(),
  canCreateUser: z.boolean(),
  canDeleteUser: z.boolean(),
  assignableRoles: z.array(userRoleSchema),
  deletableRoles: z.array(userRoleSchema),
})

export const passwordResetVerifyResponseSchema = z.object({
  resetToken: z.string().min(1),
})
