const TOKEN_STORAGE_KEY = 'blog-manager-token'

/** 만료 직전 요청이 실패하지 않도록 두는 여유 시간(초) */
const EXPIRY_MARGIN_SECONDS = 30

/** JWT payload에서 exp(초)를 읽는다. 읽을 수 없으면 null. */
function readTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed: unknown = JSON.parse(atob(base64))

    if (typeof parsed === 'object' && parsed !== null && 'exp' in parsed) {
      return typeof parsed.exp === 'number' ? parsed.exp : null
    }

    return null
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const expiry = readTokenExpiry(token)

  if (expiry === null) {
    return true
  }

  return expiry - EXPIRY_MARGIN_SECONDS <= Date.now() / 1000
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

/** 저장된 토큰을 반환한다. 없거나 만료됐으면 지우고 null을 반환한다. */
export function getToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)

  if (!token) {
    return null
  }

  if (isTokenExpired(token)) {
    clearToken()
    return null
  }

  return token
}
