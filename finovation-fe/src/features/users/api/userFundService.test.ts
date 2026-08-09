import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import { getUserFunds } from "@/features/users/api/userFundService"

describe("userFundService", () => {
  beforeEach(() => httpMocks.apiFetch.mockReset())

  it("yönetilen kullanıcı kimliğini funds sorgusuna taşır", async () => {
    httpMocks.apiFetch.mockResolvedValue([])

    await getUserFunds(42)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/funds?ownerUserId=42",
      expect.objectContaining({
        errorMessage: "Kullanıcının fonları alınamadı",
      }),
      expect.any(Function),
    )
  })
})
