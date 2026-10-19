import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiPost } from '../api-client'
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
  assign.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('location', { pathname: '/', search: '', origin: 'http://localhost:5173', assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiPost', () => {
  describe('정상', () => {
    it('본문을 JSON으로 직렬화해 POST로 보내고 Content-Type: application/json을 붙여야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(201, { id: 'idea-1' }))

      await apiPost('/ideas', { title: '제목', memo: '메모' })

      const { init } = lastFetchCall()
      expect(init.method).toBe('POST')
      expect(init.body).toBe(JSON.stringify({ title: '제목', memo: '메모' }))
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    })

    it('토큰이 있으면 Authorization: Bearer <토큰>을 붙여야 한다', async () => {
      const token = createToken()
      saveToken(token)
      fetchMock.mockImplementation(async () => jsonResponse(201))

      await apiPost('/ideas', {})

      expect(lastFetchCall().init.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    })

    it('성공 응답의 JSON을 돌려줘야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(201, { id: 'idea-1', status: 'todo' }))

      await expect(apiPost('/ideas', {})).resolves.toEqual({ id: 'idea-1', status: 'todo' })
    })

    it('baseUrl을 넘기면 BLOG_API_URL 대신 그 주소 뒤에 path를 붙여 요청해야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(201))

      await apiPost('/ideas', {}, { baseUrl: 'https://server.example' })

      expect(lastFetchCall().url).toBe('https://server.example/ideas')
    })
  })

  describe('경계', () => {
    it('baseUrl을 생략하면 BLOG_API_URL을 써야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(201))

      await apiPost('/api/projects', {})

      expect(lastFetchCall().url).toBe('http://blog.test/api/projects')
    })

    it('본문이 없는 응답이면 undefined로 resolve해야 한다', async () => {
      fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))

      await expect(apiPost('/ideas', {})).resolves.toBeUndefined()
    })

    it('signal을 넘기면 fetch에 그대로 전달해야 한다', async () => {
      const controller = new AbortController()
      fetchMock.mockImplementation(async () => jsonResponse(201))

      await apiPost('/ideas', {}, { signal: controller.signal })

      expect(lastFetchCall().init.signal).toBe(controller.signal)
    })
  })

  describe('예외', () => {
    it('응답이 401이면 저장된 토큰을 지우고 redirectToBlogLogin을 현재 경로로 한 번 호출하며 ApiError(401)로 거부해야 한다', async () => {
      saveToken(createToken())
      vi.stubGlobal('location', { pathname: '/', search: '?tab=1', origin: 'http://localhost:5173', assign })
      fetchMock.mockImplementation(async () => jsonResponse(401))

      const error = await apiPost('/ideas', {}).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(401)
      expect(getToken()).toBeNull()
      expect(mockedRedirect).toHaveBeenCalledTimes(1)
      expect(mockedRedirect).toHaveBeenCalledWith('/?tab=1')
    })

    it('응답이 403이면 저장된 토큰을 지우고 redirectToBlogLogin을 호출하며 ApiError(403)로 거부해야 한다', async () => {
      saveToken(createToken())
      fetchMock.mockImplementation(async () => jsonResponse(403))

      const error = await apiPost('/ideas', {}).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(403)
      expect(getToken()).toBeNull()
      expect(mockedRedirect).toHaveBeenCalledTimes(1)
    })

    it.each([400, 500])('응답이 %i이면 ApiError(status)로 거부하고 토큰은 지우지 않으며 재로그인하지 않아야 한다', async (status) => {
      const token = createToken()
      saveToken(token)
      fetchMock.mockImplementation(async () => jsonResponse(status))

      const error = await apiPost('/ideas', {}).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(status)
      expect(getToken()).toBe(token)
      expect(mockedRedirect).not.toHaveBeenCalled()
    })

    it.each([401, 403])('응답이 %i이지만 재로그인 루프 상태면 토큰만 지우고 재로그인은 호출하지 않으며 ApiError로 거부해야 한다', async (status) => {
      saveToken(createToken())
      sessionStorage.setItem('blog-manager-relogin-at', String(Date.now()))
      fetchMock.mockImplementation(async () => jsonResponse(status))

      const error = await apiPost('/ideas', {}).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(status)
      expect(getToken()).toBeNull()
      expect(mockedRedirect).not.toHaveBeenCalled()
    })

    it('네트워크 오류이면 fetch의 오류로 거부해야 한다', async () => {
      const networkError = new TypeError('Failed to fetch')
      fetchMock.mockRejectedValue(networkError)

      await expect(apiPost('/ideas', {})).rejects.toBe(networkError)
    })
  })
})
