import { getPasswordValidationMessage } from "@/shared/lib/passwordPolicy"

export type PasswordChangePayload = {
  newPassword: string
  newPasswordConfirm: string
}

export function isPasswordChangeValid({
  newPassword,
  newPasswordConfirm,
}: PasswordChangePayload): boolean {
  return (
    getPasswordValidationMessage(newPassword) === null &&
    newPassword === newPasswordConfirm
  )
}
