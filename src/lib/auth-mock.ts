export const MOCK_COOKIE = 'gp_user'

export function parseMockUser(cookieValue: string | undefined) {
  if (!cookieValue) return null
  try {
    return JSON.parse(decodeURIComponent(cookieValue)) as { name: string; email: string }
  } catch {
    return null
  }
}

export function encodeMockUser(name: string, email: string) {
  return encodeURIComponent(JSON.stringify({ name, email }))
}

export function readUserCookie() {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find(c => c.startsWith(MOCK_COOKIE + '='))?.split('=')[1]
  return parseMockUser(raw)
}
