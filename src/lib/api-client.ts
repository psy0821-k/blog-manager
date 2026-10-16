import { redirectToBlogLogin } from './auth-redirect'
import { clearToken, getToken } from './auth-token'
import { BLOG_API_URL } from './env'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type QueryValue = string | number | undefined

export interface ApiGetOptions {
  query?: Record<string, QueryValue>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }

  const queryString = params.toString()
  return `${BLOG_API_URL}${path}${queryString ? `?${queryString}` : ''}`
}

/** 토큰이 있으면 Bearer 헤더로 실어 GET 요청하고 JSON을 반환한다. */
export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const token = getToken()
  // 재로그인 후 돌아올 경로는 요청을 보낸 시점의 화면 경로로 잡는다
  const requestPath = window.location.pathname + window.location.search

  const response = await fetch(buildUrl(path, options.query), {
    signal: options.signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!response.ok) {
    // 서버가 거부한 토큰은 지우고 재로그인을 시작한다
    if (response.status === 401 || response.status === 403) {
      clearToken()
      redirectToBlogLogin(requestPath)
    }

    throw new ApiError(response.status, `요청에 실패했습니다. (${response.status})`)
  }

  return (await response.json()) as T
}
