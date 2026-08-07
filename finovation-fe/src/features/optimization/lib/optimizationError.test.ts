import { describe, expect, it } from "vitest"

import { getOptimizationErrorMessage } from "@/features/optimization/lib/optimizationError"
import { ApiRequestError } from "@/shared/api/apiError"

describe("getOptimizationErrorMessage", () => {
  it("merkezi API katmanının güvenli kullanıcı mesajını korur", () => {
    const error = new ApiRequestError(
      "Bu optimizasyon isteği şu anki durumundan istenen duruma geçemez.",
      409,
      "OPT_008",
    )

    expect(getOptimizationErrorMessage(error)).toBe(
      "Bu optimizasyon isteği şu anki durumundan istenen duruma geçemez.",
    )
  })

  it("bilinmeyen teknik hata metnini kullanıcıya taşımaz", () => {
    expect(
      getOptimizationErrorMessage(
        new Error("EXTERNAL_SERVICE_ERROR: engine not connected"),
      ),
    ).toBe("Optimizasyon çalıştırılamadı. Lütfen daha sonra tekrar deneyin.")
  })
})
