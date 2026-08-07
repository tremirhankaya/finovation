import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiSend: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "@/features/users/api/userService"

describe("userService", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
    httpMocks.apiSend.mockReset()
  })

  it("liste filtrelerini query string'e doğru taşır", async () => {
    httpMocks.apiFetch.mockResolvedValue({ content: [] })

    await getUsers({
      page: 2,
      size: 20,
      q: "  batuhan  ",
      role: "COMPANY_MANAGER",
      status: "ACTIVE",
      companyId: 7,
      createdFrom: "2026-08-01",
      createdTo: "2026-08-03",
    })

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/users?page=2&size=20&q=batuhan&role=COMPANY_MANAGER&status=ACTIVE&companyId=7&createdFrom=2026-08-01&createdTo=2026-08-03",
      expect.objectContaining({ errorMessage: "Kullanıcı listesi alınamadı" }),
      expect.any(Function),
    )
  })

  it("create, update ve delete payloadlarını HTTP katmanına aktarır", async () => {
    httpMocks.apiFetch.mockResolvedValue({ id: 2 })
    httpMocks.apiSend.mockResolvedValue(undefined)

    await createUser({
      username: "batuhan",
      firstName: "Batuhan",
      lastName: "Pınar",
      email: "batuhan@example.com",
      password: " Valid1! ",
      role: "COMPANY_MANAGER",
      companyId: 7,
    })
    await updateUser(2, {
      firstName: "Batuhan",
      lastName: "Pınar",
      email: "batuhan@example.com",
      role: "COMPANY_MANAGER",
      status: "ACTIVE",
      companyId: 7,
    })
    await deleteUser(2)

    expect(httpMocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/users",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ password: " Valid1! " }),
      }),
      expect.any(Function),
    )
    expect(httpMocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/users/2",
      expect.objectContaining({
        method: "PUT",
        body: expect.not.objectContaining({ password: expect.anything() }),
      }),
      expect.any(Function),
    )
    expect(httpMocks.apiSend).toHaveBeenCalledWith(
      "/api/v1/users/2",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
