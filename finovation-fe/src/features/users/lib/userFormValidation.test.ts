import { describe, expect, it } from "vitest"

import { validateProfileFields } from "@/features/users/lib/userFormValidation"

describe("validateProfileFields", () => {
  it("zorunlu ve e-posta alanlarını doğrular", () => {
    const errors = validateProfileFields(
      {
        username: " ",
        firstName: "Batuhan",
        lastName: " ",
        email: "gecersiz",
        companyId: null,
      },
      { requiresUsername: true, requiresCompany: true },
    )

    expect(errors).toEqual({
      username: "Kullanıcı adı zorunludur.",
      lastName: "Soyad zorunludur.",
      email: "Geçerli bir e-posta girin.",
      companyId: "Şirket seçimi zorunludur.",
    })
  })

  it("geçerli profil için hata üretmez", () => {
    expect(
      validateProfileFields({
        firstName: "Batuhan",
        lastName: "Pınar",
        email: "batuhan@example.com",
      }),
    ).toEqual({})
  })
})
