const ACCESS_TOKEN_KEY = "accessToken"

export function saveAccessToken(accessToken: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}
