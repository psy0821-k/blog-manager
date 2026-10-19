import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDelete, apiPatch } from '../api-client'
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

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status })
}

/** fetch가 받은 (url, init) 중 마지막 호출 */
function lastFetchCall() {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch가 호출되지 않았습니다.')

  const [url, init] = call
  return { url: String(url), init: init ?? {} }
}

beforeEach(() => {
  sessionStorage.clear()
  mockedRedirect.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('location', { pathname: '/', search: '', origin: 'http://localhost:5173', assign: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiPatch / apiDelete baseUrl', () => {
  describe('정상', () => {
    it('apiPatch에 baseUrl을 넘기면 BLOG_API_URL 대신 그 주소 뒤에 path를 붙여 PATCH로 요청해야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(200, { id: 'idea-1' }))

      await apiPatch('/ideas/idea-1', { status: 'doing' }, { baseUrl: '/server-api' })

      expect(lastFetchCall().url).toBe('/server-api/ideas/idea-1')
      expect(lastFetchCall().init.method).toBe('PATCH')
      expect(lastFetchCall().init.body).toBe(JSON.stringify({ status: 'doing' }))
    })

    it('apiDelete에 baseUrl을 넘기면 그 주소 뒤에 path를 붙여 DELETE로 요청해야 한다', async () => {
      fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))

      await apiDelete('/ideas/idea-1', { baseUrl: '/server-api' })

      expect(lastFetchCall().url).toBe('/server-api/ideas/idea-1')
      expect(lastFetchCall().init.method).toBe('DELETE')
    })
  })

  describe('경계', () => {
    it('baseUrl을 생략하면 BLOG_API_URL을 써야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(200, {}))

      await apiPatch('/api/projects/slug', { published: true })
      expect(lastFetchCall().url).toBe('http://blog.test/api/projects/slug')

      fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
      await apiDelete('/api/projects/slug')
      expect(lastFetchCall().url).toBe('http://blog.test/api/projects/slug')
    })
  })

  describe('예외', () => {
    it('baseUrl을 넘긴 PATCH가 401이면 토큰을 지우고 재로그인을 호출하며 ApiError(401)로 거부해야 한다', async () => {
      saveToken(createToken())
      fetchMock.mockImplementation(async () => jsonResponse(401))

      const error = await apiPatch('/ideas/idea-1', { status: 'doing' }, { baseUrl: '/server-api' }).catch(
        (reason: unknown) => reason,
      )

      expect(lastFetchCall().url).toBe('/server-api/ideas/idea-1')
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(401)
      expect(getToken()).toBeNull()
      expect(mockedRedirect).toHaveBeenCalledTimes(1)
    })
  })
})
