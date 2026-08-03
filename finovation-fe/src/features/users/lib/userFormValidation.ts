export const USERNAME_MAX_LENGTH = 100
export const NAME_MAX_LENGTH = 100
export const EMAIL_MAX_LENGTH = 254

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ProfileFieldErrors = {
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  companyId?: string
}

function requiredOrMaxLength(
  value: string,
  label: string,
  maxLength: number,
): string | undefined {
  const normalized = value.trim()

  if (!normalized) return `${label} zorunludur.`
  if (normalized.length > maxLength) {
    return `${label} en fazla ${maxLength} karakter olabilir.`
  }

  return undefined
}

export function validateProfileFields(
  form: {
    username?: string
    firstName: string
    lastName: string
    email: string
    companyId?: number | null
  },
  options: {
    requiresUsername?: boolean
    requiresCompany?: boolean
  } = {},
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  if (options.requiresUsername) {
    errors.username = requiredOrMaxLength(
      form.username ?? "",
      "Kullanıcı adı",
      USERNAME_MAX_LENGTH,
    )
  }

  errors.firstName = requiredOrMaxLength(form.firstName, "Ad", NAME_MAX_LENGTH)
  errors.lastName = requiredOrMaxLength(form.lastName, "Soyad", NAME_MAX_LENGTH)
  errors.email = requiredOrMaxLength(form.email, "E-posta", EMAIL_MAX_LENGTH)

  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Geçerli bir e-posta girin."
  }

  if (options.requiresCompany && form.companyId == null) {
    errors.companyId = "Şirket seçimi zorunludur."
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as ProfileFieldErrors
}
