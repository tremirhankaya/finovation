import { describe, expect, it } from "vitest"

import { getFundMonitoringErrorMessage } from "@/features/fund-monitoring/lib/fundMonitoringError"
import { ApiRequestError } from "@/shared/api/apiError"

describe("getFundMonitoringErrorMessage", () => {
  it("merkezi API katmanının güvenli kullanıcı mesajını korur", () => {
    const error = new ApiRequestError(
      "Fon verilerine erişim yetkiniz yok.",
      403,
      "AUTH_004",
    )

    expect(getFundMonitoringErrorMessage(error)).toBe(
      "Fon verilerine erişim yetkiniz yok.",
    )
  })

  it("bilinmeyen teknik hata metnini kullanıcıya taşımaz", () => {
    expect(
      getFundMonitoringErrorMessage(
        new Error("SQL connection pool has been exhausted"),
      ),
    ).toBe("Fon izleme verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.")
  })
})
