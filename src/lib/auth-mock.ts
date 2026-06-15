import type { Role } from './types'

export const MOCK_COOKIE = 'gp_user'

export interface MockUser {
  name: string
  email: string
  role: Role
}

export function parseMockUser(cookieValue: string | undefined): MockUser | null {
  if (!cookieValue) return null
  try {
    const raw = JSON.parse(decodeURIComponent(cookieValue)) as Partial<MockUser>
    if (!raw.email) return null
    return {
      name: raw.name || raw.email.split('@')[0],
      email: raw.email,
      role: (raw.role as Role) || 'admin', // contas antigas viram admin
    }
  } catch {
    return null
  }
}

export function encodeMockUser(name: string, email: string, role: Role = 'admin'): string {
  return encodeURIComponent(JSON.stringify({ name, email, role }))
}

export function readUserCookie(): MockUser | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find(c => c.startsWith(MOCK_COOKIE + '='))?.split('=')[1]
  return parseMockUser(raw)
}

export function setUserCookie(user: MockUser): void {
  document.cookie = `${MOCK_COOKIE}=${encodeMockUser(user.name, user.email, user.role)}; path=/; max-age=${60 * 60 * 24 * 30}`
}

export function clearUserCookie(): void {
  document.cookie = `${MOCK_COOKIE}=; path=/; max-age=0`
}
