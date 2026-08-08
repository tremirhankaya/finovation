import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
}))

vi.mock("@/shared/api/httpClient", () => httpMocks)

import { changePassword } from "@/features/account/api/accountService"

describe("accountService", () => {
  beforeEach(() => {
    httpMocks.apiSend.mockReset().mockResolvedValue(undefined)
  })

  it("parola çiftini authenticated password endpointine gönderir", async () => {
    await changePassword({
      newPassword: "NewPassword1!",
      newPasswordConfirm: "NewPassword1!",
    })

    expect(httpMocks.apiSend).toHaveBeenCalledWith("/api/v1/auth/password", {
      method: "PUT",
      body: {
        newPassword: "NewPassword1!",
        newPasswordConfirm: "NewPassword1!",
      },
      errorMessage: "Parola değiştirilemedi",
    })
  })
})
