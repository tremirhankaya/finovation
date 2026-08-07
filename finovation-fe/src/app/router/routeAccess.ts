import type { MeResponse } from "@/features/auth/model/auth.types"

export function getAuthenticatedHomePath(
  user: Pick<MeResponse, "role">,
): "/users" | "/dashboard" {
  return user.role === "ADMIN" ? "/users" : "/dashboard"
}
