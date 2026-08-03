import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getCompanies: vi.fn(),
}))

vi.mock("@/features/users/api/userService", () => ({
  getUsers: serviceMocks.getUsers,
}))
vi.mock("@/features/users/api/companyService", () => ({
  getCompanies: serviceMocks.getCompanies,
}))

import { useCompanyOptions } from "@/features/users/hooks/useCompanyOptions"
import { useUsersList } from "@/features/users/hooks/useUsersList"

const FILTERS = {
  q: "",
  role: "" as const,
  status: "" as const,
  companyId: null,
  createdFrom: "",
  createdTo: "",
}

describe("user data hooks", () => {
  beforeEach(() => {
    serviceMocks.getUsers.mockReset()
    serviceMocks.getCompanies.mockReset()
  })

  it("kullanıcı sayfasını yükleyip sayfalama bilgisini aktarır", async () => {
    serviceMocks.getUsers.mockResolvedValue({
      content: [
        {
          id: 1,
          username: "batuhan",
          firstName: "Batuhan",
          lastName: "Pınar",
          fullName: "Batuhan Pınar",
          email: "batuhan@example.com",
          companyId: 2,
          companyName: "Infina",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: "2026-08-03T00:00:00",
        },
      ],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    })

    const { result } = renderHook(() =>
      useUsersList({ filters: FILTERS, page: 0, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.users).toHaveLength(1)
    expect(result.current.totalElements).toBe(1)
    expect(result.current.error).toBe("")
    expect(serviceMocks.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 10 }),
      expect.any(AbortSignal),
    )
  })

  it("şirket isteği başarısız olduğunda tekrar denenebilir hata döndürür", async () => {
    serviceMocks.getCompanies
      .mockRejectedValueOnce(new Error("Şirket listesi alınamadı."))
      .mockResolvedValueOnce([{ id: 2, name: "Infina" }])

    const { result } = renderHook(() => useCompanyOptions())

    await waitFor(() =>
      expect(result.current.error).toBe("Şirket listesi alınamadı."),
    )

    result.current.reload()

    await waitFor(() => expect(result.current.companies).toHaveLength(1))
    expect(result.current.error).toBe("")
  })
})
