import { BLOG_LOGIN_URL } from './env'

const RETURN_PATH_STORAGE_KEY = 'blog-manager-return-path'
const DEFAULT_RETURN_PATH = '/'
const BLOCKED_PATHS = ['/login', '/auth/callback']

/** 앱 내부 경로만 허용한다. 그 외(외부 URL, //, \, 로그인 관련 경로)는 "/"로 바꾼다. */
export function sanitizeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return DEFAULT_RETURN_PATH
  }

  const pathname = path.split(/[?#]/)[0]

  if (BLOCKED_PATHS.includes(pathname)) {
    return DEFAULT_RETURN_PATH
  }

  return path
}

export function saveReturnPath(path: string): void {
  sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, path)
}

/** 저장된 복귀 경로를 읽고 지운 뒤 검증해서 반환한다. */
export function takeReturnPath(): string {
  const path = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)
  sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY)

  return sanitizeReturnPath(path)
}

export function buildBlogLoginUrl(blogLoginUrl: string, callbackUrl: string): string {
  return `${blogLoginUrl}?redirect=${encodeURIComponent(callbackUrl)}`
}

/** "#token=xxx" 형태의 해시에서 토큰을 읽는다. 없거나 비어 있으면 null. */
export function readTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')

  return token ? token : null
}

export function redirectToBlogLogin(returnPath: string): void {
  saveReturnPath(returnPath)
  window.location.assign(buildBlogLoginUrl(BLOG_LOGIN_URL, `${window.location.origin}/auth/callback`))
}
