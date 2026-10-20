import { isReloginLooping, redirectToBlogLogin } from './auth-redirect'
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
  /** 생략하면 블로그 API 주소(BLOG_API_URL). 자체 서버는 SERVER_API_URL을 넘긴다. */
  baseUrl?: string
}

function buildUrl(path: string, query?: Record<string, QueryValue>, baseUrl = BLOG_API_URL): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }

  const queryString = params.toString()
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method: HttpMethod
  query?: Record<string, QueryValue>
  /** 있으면 JSON으로 직렬화해 Content-Type: application/json과 함께 보낸다. */
  body?: unknown
  signal?: AbortSignal
  /** 생략하면 블로그 API 주소(BLOG_API_URL). */
  baseUrl?: string
}

export interface ApiWriteOptions {
  signal?: AbortSignal
  /** 생략하면 블로그 API 주소(BLOG_API_URL). 자체 서버는 SERVER_API_URL을 넘긴다. */
  baseUrl?: string
}

export interface ApiPostOptions extends ApiWriteOptions {
  /** 생략하면 블로그 API 주소(BLOG_API_URL). 자체 서버는 SERVER_API_URL을 넘긴다. */
  baseUrl?: string
}

/** apiGet/apiPost/apiPatch/apiDelete가 공유하는 요청 코어. 본문 없는 응답(204 등)은 undefined로 반환한다. */
async function request<T>(path: string, { method, query, body, signal, baseUrl }: RequestOptions): Promise<T> {
  const token = getToken()
  // 재로그인 후 돌아올 경로는 요청을 보낸 시점의 화면 경로로 잡는다
  const requestPath = window.location.pathname + window.location.search

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(buildUrl(path, query, baseUrl), {
    method,
    signal,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    // 서버가 거부한 토큰은 지우고 재로그인을 시작한다.
    // 방금 재로그인했는데 또 거부되면(토큰을 계속 거부하는 환경) 다시 보내지 않고 오류만 남겨 루프를 끊는다.
    if (response.status === 401 || response.status === 403) {
      clearToken()

      if (!isReloginLooping()) {
        redirectToBlogLogin(requestPath)
      }
    }

    throw new ApiError(response.status, `요청에 실패했습니다. (${response.status})`)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** 토큰이 있으면 Bearer 헤더로 실어 GET 요청하고 JSON을 반환한다. */
export function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  return request<T>(path, { method: 'GET', ...options })
}

/** 토큰을 Bearer로 실어 JSON 본문을 POST하고 응답 JSON(없으면 undefined)을 반환한다. */
export function apiPost<T>(path: string, body: unknown, options: ApiPostOptions = {}): Promise<T> {
  return request<T>(path, { method: 'POST', body, signal: options.signal, baseUrl: options.baseUrl })
}

/** 토큰을 Bearer로 실어 DELETE 요청한다. 성공(204 등 본문 없음)이면 undefined로 resolve한다. */
export function apiDelete(path: string, options: ApiWriteOptions = {}): Promise<void> {
  return request<void>(path, { method: 'DELETE', signal: options.signal, baseUrl: options.baseUrl })
}

/** 토큰을 Bearer로 실어 PATCH 요청하고 JSON(없으면 undefined)을 반환한다. */
export function apiPatch<T>(path: string, body: unknown, options: ApiWriteOptions = {}): Promise<T> {
  return request<T>(path, { method: 'PATCH', body, signal: options.signal, baseUrl: options.baseUrl })
}
