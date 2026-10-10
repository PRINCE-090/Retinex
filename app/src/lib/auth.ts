const TOKEN_KEY = 'retinex_real_token'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Real image IDs are always crypto.randomUUID() (backend/middleware/upload.js).
 * Mock scan IDs are always "s-<timestamp>" (data/mockDb.ts) and can never
 * match this pattern, so this distinguishes a real upload's result from a
 * mock demo scan with no ambiguity.
 */
export function isRealImageId(id: string): boolean {
  return UUID_RE.test(id)
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}
