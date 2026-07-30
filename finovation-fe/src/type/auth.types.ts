export type AuthUser = {
  id?: string | number
  username?: string
  displayName?: string
  roles?: string[]
}

export type LoginResponse = {
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  user?: AuthUser
}
