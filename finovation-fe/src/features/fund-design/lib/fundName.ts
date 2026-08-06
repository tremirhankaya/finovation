export const FUND_NAME_MIN_LETTERS = 5
export const FUND_NAME_MAX_LENGTH = 150

export function countLetters(value: string): number {
  let count = 0
  for (const char of value) {
    if (/\p{L}/u.test(char)) count += 1
  }
  return count
}

export function hasDigit(value: string): boolean {
  return /\p{N}/u.test(value)
}

export function validateFundName(raw: string): string | null {
  const name = raw.trim()

  if (!name) {
    return "Fon adı zorunludur."
  }

  if (name.length > FUND_NAME_MAX_LENGTH) {
    return `Fon adı en fazla ${FUND_NAME_MAX_LENGTH} karakter olabilir.`
  }

  if (hasDigit(name)) {
    return "Fon adında sayı bulunamaz."
  }

  if (countLetters(name) < FUND_NAME_MIN_LETTERS) {
    return `Fon adı en az ${FUND_NAME_MIN_LETTERS} harf içermelidir.`
  }

  return null
}

export function isFundNameReady(raw: string): boolean {
  return validateFundName(raw) == null
}
