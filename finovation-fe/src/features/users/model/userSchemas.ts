import { z } from "zod"

import { userRoleSchema, userStatusSchema } from "@/shared/model/userIdentity"

export { userRoleSchema, userStatusSchema } from "@/shared/model/userIdentity"

export const companyListItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(150),
})

export const userListItemSchema = z.object({
  id: z.number(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string(),
  companyId: z.number().nullable(),
  companyName: z.string().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  createdAt: z.string(),
})

export const userDetailSchema = userListItemSchema.omit({ fullName: true })

export const userPageResponseSchema = z.object({
  content: z.array(userListItemSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
})

export const companyListSchema = z.array(companyListItemSchema)
