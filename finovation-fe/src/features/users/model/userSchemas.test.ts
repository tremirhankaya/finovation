import { describe, expect, it } from "vitest"

import {
  userListItemSchema,
  userPageResponseSchema,
} from "@/features/users/model/userSchemas"

const USER = {
  id: 1,
  username: "batuhan",
  firstName: "Batuhan",
  lastName: "Pınar",
  fullName: "Batuhan Pınar",
  email: "batuhan@example.com",
  companyId: 3,
  companyName: "Infina",
  role: "USER",
  status: "LOCKED",
  createdAt: "2026-08-02T10:00:00",
}

describe("user API schemas", () => {
  it("LOCKED durumunu geçerli backend değeri olarak kabul eder", () => {
    expect(userListItemSchema.parse(USER).status).toBe("LOCKED")
  })

  it("bozuk sayfalama sözleşmesini reddeder", () => {
    expect(() =>
      userPageResponseSchema.parse({
        content: [USER],
        page: -1,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    ).toThrow()
  })
})
