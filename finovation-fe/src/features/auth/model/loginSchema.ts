import { z } from "zod"

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Kullanıcı adı zorunludur."),
  password: z.string().min(1, "Şifre zorunludur."),
})

export type LoginCredentials = z.infer<typeof loginSchema>
export type LoginFieldErrors = Partial<Record<keyof LoginCredentials, string>>

type LoginValidationResult = {
  success: true
  data: LoginCredentials
  errors: LoginFieldErrors
} | {
  success: false
  data: null
  errors: LoginFieldErrors
}

export function validateLoginCredentials(
  input: unknown,
): LoginValidationResult {
  const result = loginSchema.safeParse(input)

  if (result.success) {
    return { success: true, data: result.data, errors: {} }
  }

  const errors = result.error.issues.reduce<LoginFieldErrors>(
    (fieldErrors, issue) => {
      const field = issue.path[0]

      if (
        (field === "username" || field === "password") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message
      }

      return fieldErrors
    },
    {},
  )

  return { success: false, data: null, errors }
}
