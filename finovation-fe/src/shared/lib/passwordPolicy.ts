export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/

export const PASSWORD_RULES_HELP =
  "En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli."

export function isValidPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password)
}

export function getPasswordValidationMessage(password: string): string | null {
  if (!password) {
    return "Yeni parola zorunludur."
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Parola en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.`
  }

  if (!isValidPassword(password)) {
    return PASSWORD_RULES_HELP
  }

  return null
}
