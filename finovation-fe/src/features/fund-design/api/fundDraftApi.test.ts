import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import {
  createFundDraft,
  getFundDraftLimits,
} from "@/features/fund-design/api/fundDraftApi"

describe("fundDraftApi", () => {
  beforeEach(() => {
    httpMocks.apiFetch.mockReset()
  })

  it("limitleri GET /fund-drafts/limits üzerinden alır", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      minInitialPortfolioSize: 1_000_000,
      maxInitialPortfolioSize: 100_000_000_000,
    })

    await getFundDraftLimits()

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/fund-drafts/limits",
      expect.objectContaining({ errorMessage: "Portföy limiti alınamadı" }),
      expect.any(Function),
    )
  })

  it("taslak oluşturmayı POST /fund-drafts ile gönderir", async () => {
    httpMocks.apiFetch.mockResolvedValue({
      draftId: "11111111-1111-1111-1111-111111111111",
    })

    await createFundDraft(100_000_000)

    expect(httpMocks.apiFetch).toHaveBeenCalledWith(
      "/api/v1/fund-drafts",
      expect.objectContaining({
        method: "POST",
        body: { initialPortfolioSize: 100_000_000 },
      }),
      expect.any(Function),
    )
  })
})
