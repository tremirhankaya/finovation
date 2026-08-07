import { describe, expect, it } from "vitest"

import { ApiRequestError, toApiRequestError } from "@/shared/api/apiError"

describe("toApiRequestError", () => {
  it("bilinen backend kodunu kullanıcı dostu mesaja çevirir", () => {
    const error = toApiRequestError(
      { code: "USER_002", message: "Email already exists" },
      409,
      "İşlem başarısız",
    )

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error.message).toBe(
      "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.",
    )
    expect(error.status).toBe(409)
  })

  it("login hata kodunu hazır AUTH mesajına çevirir", () => {
    const apiError = toApiRequestError(
      { code: "AUTH_001", message: "Invalid username or password." },
      401,
      "Giriş başarısız oldu",
    )

    expect(apiError.message).toBe("Kullanıcı adı veya şifre hatalı.")
  })

  it("alan doğrulama mesajını kullanıcıya taşımaz", () => {
    const error = toApiRequestError(
      {
        code: "GEN_002",
        errors: [{ field: "email", message: "Geçersiz e-posta" }],
      },
      400,
      "Doğrulama başarısız",
    )

    expect(error.message).toBe("Doğrulama başarısız.")
  })

  it("GEN_400 kodunu sabit Türkçe mesaja çevirir", () => {
    const error = toApiRequestError(
      {
        code: "GEN_400",
        message: "Validation failed.",
        errors: [
          {
            field: "firstName",
            message: "First name must not be blank.",
          },
        ],
      },
      400,
      "Kullanıcı güncellenemedi",
    )

    expect(error.message).toBe(
      "Gönderilen bilgiler geçersiz. Lütfen alanları kontrol edin.",
    )
  })

  it("bilinmeyen backend mesajını kullanıcıya göstermez", () => {
    const error = toApiRequestError(
      {
        code: "FUTURE_001",
        message: "Internal implementation detail",
      },
      400,
      "İşlem tamamlanamadı",
    )

    expect(error.message).toBe("İşlem tamamlanamadı.")
    expect(error.message).not.toContain("Internal implementation detail")
  })

  it("özel backend detayını yok sayıp sabit hata kodunu kullanır", () => {
    const error = toApiRequestError(
      {
        code: "AUTH_004",
        message: "You cannot delete your own account.",
      },
      403,
      "Kullanıcı silinemedi",
    )

    expect(error.message).toBe("Bu işlem için yetkiniz yok.")
    expect(error.message).not.toContain("You cannot delete")
  })

  it("FUND_001 kodunu kullanıcı dostu mesaja çevirir", () => {
    const error = toApiRequestError(
      {
        code: "FUND_001",
        message: "The initial portfolio size is outside the allowed range.",
      },
      400,
      "Fon taslağı oluşturulamadı",
    )

    expect(error.message).toBe(
      "Başlangıç portföy büyüklüğü izin verilen aralığın dışında.",
    )
    expect(error.message).not.toContain("outside the allowed range")
  })

  it("FUND_002 kodunu kullanıcı dostu mesaja çevirir", () => {
    const error = toApiRequestError(
      {
        code: "FUND_002",
        message: "Fund not found.",
      },
      404,
      "Fon alınamadı",
    )

    expect(error.message).toBe(
      "Fon bulunamadı veya bu fonu görüntüleme yetkiniz yok.",
    )
    expect(error.message).not.toContain("Fund not found")
  })

  it("FUND_004 kodunu kullanıcı dostu mesaja çevirir", () => {
    const error = toApiRequestError(
      {
        code: "FUND_004",
        message: "Fund draft not found.",
      },
      404,
      "Fon taslağı alınamadı",
    )

    expect(error.message).toBe("Fon taslağı bulunamadı.")
    expect(error.message).not.toContain("Fund draft not found")
  })

  it("FUND_006 kodunu kullanıcı dostu mesaja çevirir", () => {
    const error = toApiRequestError(
      {
        code: "FUND_006",
        message: "The fund unit price is outside the allowed range.",
      },
      400,
      "Fon taslağı oluşturulamadı",
    )

    expect(error.message).toBe(
      "Fon pay fiyatı izin verilen aralığın dışında.",
    )
    expect(error.message).not.toContain("outside the allowed range")
  })

  it("403 yanıtını yetki hatası olarak işaretler", () => {
    const error = toApiRequestError({}, 403, "İşlem başarısız")

    expect(error.isPermissionError).toBe(true)
  })

  it("OPT_003 kodunu kısıt aralığı mesajına çevirir", () => {
    const error = toApiRequestError(
      {
        code: "OPT_003",
        message: "The constraint value is outside the allowed range.",
      },
      400,
      "Optimizasyon senaryosu oluşturulamadı",
    )

    expect(error.message).toBe(
      "Girilen kısıt değerleri izin verilen aralığın dışında.",
    )
    expect(error.message).not.toContain("outside the allowed range")
  })

  it("OPT_005 kodunu çakışan hisse tercihi mesajına çevirir", () => {
    const error = toApiRequestError(
      {
        code: "OPT_005",
        message: "An asset cannot be both excluded and force-added.",
      },
      400,
      "Optimizasyon senaryosu oluşturulamadı",
    )

    expect(error.message).toBe(
      "Bir hisse aynı anda hem hariç tutulacaklar hem zorunlu eklenecekler arasında olamaz.",
    )
  })

  it("OPT_008 kodunu geçersiz durum geçişi mesajına çevirir", () => {
    const error = toApiRequestError(
      {
        code: "OPT_008",
        message: "This optimization request cannot change status.",
      },
      409,
      "İşlem tamamlanamadı",
    )

    expect(error.message).toBe(
      "Bu optimizasyon isteği şu anki durumundan istenen duruma geçemez.",
    )
  })
})
