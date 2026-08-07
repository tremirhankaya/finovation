import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiSend: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  createCompany,
  deleteCompany,
  getCompanies,
} from "@/features/users/api/companyService"

describe("companyService", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
    httpMocks.apiSend.mockReset()
  })

  it("şirket listesini runtime şemasıyla doğrular", async () => {
    httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
      Promise.resolve(parse([{ id: 7, name: "Infina" }])),
    )

    await expect(getCompanies()).resolves.toEqual([{ id: 7, name: "Infina" }])
    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/companies",
      expect.objectContaining({ errorMessage: "Şirket listesi alınamadı" }),
      expect.any(Function),
    )
  })

  it("şirket oluşturma ve silme isteklerini doğru endpointlere gönderir", async () => {
    httpMocks.apiFetch.mockImplementation((_url, _options, parse) =>
      Promise.resolve(parse({ id: 8, name: "Yeni Şirket" })),
    )
    httpMocks.apiSend.mockResolvedValue(undefined)

    await createCompany({ name: "Yeni Şirket" })
    await deleteCompany(8)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/companies",
      expect.objectContaining({
        method: "POST",
        body: { name: "Yeni Şirket" },
      }),
      expect.any(Function),
    )
    expect(httpMocks.apiSend).toHaveBeenCalledWith(
      "/api/v1/companies/8",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
