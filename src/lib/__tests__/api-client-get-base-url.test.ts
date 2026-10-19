import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet } from '../api-client'
import * as authRedirect from '../auth-redirect'
import { getToken, saveToken } from '../auth-token'

vi.mock('../env', () => ({
  BLOG_API_URL: 'http://blog.test',
  BLOG_LOGIN_URL: 'http://localhost:3000/admin-login',
  SERVER_API_URL: '/server-api',
}))

// redirectToBlogLogin만 감시용 함수로 바꾸고 나머지는 실제 구현을 쓴다
vi.mock('../auth-redirect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth-redirect')>()

  return { ...actual, redirectToBlogLogin: vi.fn() }
})

const mockedRedirect = vi.mocked(authRedirect.redirectToBlogLogin)
const fetchMock = vi.fn<typeof fetch>()
const assign = vi.fn()

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status })
}

function lastFetchUrl() {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch가 호출되지 않았습니다.')

  return String(call[0])
}

beforeEach(() => {
  sessionStorage.clear()
  mockedRedirect.mockReset()
  assign.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('location', { pathname: '/', search: '', origin: 'http://localhost:5173', assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet baseUrl', () => {
  it('baseUrl을 넘기면 BLOG_API_URL 대신 그 주소 뒤에 path와 쿼리를 붙여 요청해야 한다', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { data: [] }))

    await apiGet('/ideas', { baseUrl: '/server-api', query: { status: 'doing' } })

    expect(lastFetchUrl()).toBe('/server-api/ideas?status=doing')
  })

  it('baseUrl을 생략하면 BLOG_API_URL을 써야 한다', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { data: [] }))

    await apiGet('/api/projects')

    expect(lastFetchUrl()).toBe('http://blog.test/api/projects')
  })

  it('baseUrl을 넘겨도 토큰이 있으면 Authorization: Bearer를 붙여야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockImplementation(async () => jsonResponse(200, {}))

    await apiGet('/ideas', { baseUrl: '/server-api' })

    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` })
  })

  it('baseUrl을 넘긴 요청이 401이면 저장된 토큰을 지우고 redirectToBlogLogin을 호출하며 ApiError(401)로 거부해야 한다', async () => {
    saveToken(createToken())
    fetchMock.mockImplementation(async () => jsonResponse(401))

    const error = await apiGet('/ideas', { baseUrl: '/server-api' }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(getToken()).toBeNull()
    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })
})
