import { beforeEach, describe, expect, it, vi } from "vitest"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("httpClient", () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetModules()
  })

  it("korumalı isteğe Bearer access token ekler", async () => {
    sessionStorage.setItem("accessToken", "access-1")
    sessionStorage.setItem("refreshToken", "refresh-1")
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: 1 }))
    const { apiFetch } = await import("@/shared/api/httpClient")

    await apiFetch("/api/example", { errorMessage: "Alınamadı" })

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get("Authorization")).toBe("Bearer access-1")
  })

  it("bozuk API yanıtında şema detayını kullanıcıya sızdırmaz", async () => {
    sessionStorage.setItem("accessToken", "access-1")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ unexpected: true }),
    )
    const { apiFetch } = await import("@/shared/api/httpClient")

    await expect(
      apiFetch(
        "/api/example",
        { errorMessage: "Kullanıcı bilgisi alınamadı" },
        () => {
          throw new Error("Expected id, received undefined")
        },
      ),
    ).rejects.toThrow(
      "Kullanıcı bilgisi alınamadı. Sunucudan beklenmeyen bir yanıt alındı.",
    )
  })

  it("tarayıcının ham ağ hatasını Türkçe mesaja çevirir", async () => {
    sessionStorage.setItem("accessToken", "access-1")
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    )
    const { apiFetch } = await import("@/shared/api/httpClient")

    await expect(
      apiFetch("/api/example", { errorMessage: "İstek başarısız" }),
    ).rejects.toThrow(
      "Sunucuya bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
    )
  })

  it("eş zamanlı 401 yanıtlarında tokenı yalnızca bir kez yeniler", async () => {
    sessionStorage.setItem("accessToken", "old-access")
    sessionStorage.setItem("refreshToken", "old-refresh")

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.includes("/auth/refresh")) {
          return jsonResponse({
            accessToken: "new-access",
            refreshToken: "new-refresh",
          })
        }

        const authorization = new Headers(init?.headers).get("Authorization")
        return authorization === "Bearer old-access"
          ? jsonResponse({ code: "AUTH_003" }, 401)
          : jsonResponse({ ok: true })
      })
    const { apiFetch } = await import("@/shared/api/httpClient")

    await Promise.all([
      apiFetch("/api/first", { errorMessage: "İlk istek başarısız" }),
      apiFetch("/api/second", { errorMessage: "İkinci istek başarısız" }),
    ])

    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/auth/refresh"),
    )
    expect(refreshCalls).toHaveLength(1)
    expect(sessionStorage.getItem("accessToken")).toBe("new-access")
    expect(sessionStorage.getItem("refreshToken")).toBe("new-refresh")
  })

  it("yenilemeden sonraki ikinci 401 yanıtında oturumu sonlandırır", async () => {
    sessionStorage.setItem("accessToken", "old-access")
    sessionStorage.setItem("refreshToken", "old-refresh")

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/auth/refresh")) {
        return jsonResponse({
          accessToken: "new-access",
          refreshToken: "new-refresh",
        })
      }
      return jsonResponse({ code: "AUTH_003" }, 401)
    })

    const sessionEvents = await import("@/shared/auth/sessionEvents")
    const expiredListener = vi.fn()
    const unsubscribe = sessionEvents.onSessionExpired(expiredListener)
    const { apiFetch } = await import("@/shared/api/httpClient")

    await expect(
      apiFetch("/api/protected", { errorMessage: "İstek başarısız" }),
    ).rejects.toMatchObject({ status: 401 })

    expect(sessionStorage.getItem("accessToken")).toBeNull()
    expect(sessionStorage.getItem("refreshToken")).toBeNull()
    expect(expiredListener).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
