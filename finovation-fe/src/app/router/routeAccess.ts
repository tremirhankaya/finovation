import type { MeResponse } from "@/features/auth/model/auth.types"

export function getAuthenticatedHomePath(
  user: Pick<MeResponse, "role" | "passwordChangeRequired">,
): "/account/password-required" | "/users" | "/dashboard" {
  if (user.role !== "ADMIN" && user.passwordChangeRequired) {
    return "/account/password-required"
  }

  return user.role === "ADMIN" ? "/users" : "/dashboard"
}
