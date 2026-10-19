import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveToken } from '../../../lib/auth-token'

const fetchMock = vi.fn<typeof fetch>()

const LIST = {
  data: [
    {
      id: 'idea-1',
      title: '제목',
      memo: '- 메모',
      type: 'LAB',
      status: 'doing',
      createdAt: '2026-10-19T00:00:00.000Z',
    },
  ],
}

/** SERVER_API_URL을 바꿔 가며 확인하려고 모듈 캐시를 비우고 env를 대체한 뒤 불러온다. */
async function loadIdeasApi(serverApiUrl: string) {
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({
    BLOG_API_URL: 'http://blog.test',
    BLOG_LOGIN_URL: 'http://localhost:3000/admin-login',
    SERVER_API_URL: serverApiUrl,
  }))

  const { fetchIdeas } = await import('../ideas-api')
  const { ApiError } = await import('../../../lib/api-client')

  return { fetchIdeas, ApiError }
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

/** exp(초)만 가진 JWT를 만든다. */
function createToken(expOffsetSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  return `header.${btoa(JSON.stringify({ exp }))}.signature`
}

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => jsonResponse(200, LIST))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/env')
})

describe('fetchIdeas', () => {
  describe('정상', () => {
    it('status가 없으면 SERVER_API_URL/ideas를 쿼리 없이 GET으로 요청해야 한다', async () => {
      const { fetchIdeas } = await loadIdeasApi('/server-api')

      await fetchIdeas(undefined, new AbortController().signal)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(lastFetchCall().url).toBe('/server-api/ideas')
      expect(lastFetchCall().init.method).toBe('GET')
    })

    it('status가 있으면 ?status=<값>을 붙여 요청해야 한다', async () => {
      const { fetchIdeas } = await loadIdeasApi('https://server.example')

      await fetchIdeas('doing', new AbortController().signal)

      expect(lastFetchCall().url).toBe('https://server.example/ideas?status=doing')
    })

    it('응답의 { data }를 그대로 돌려줘야 한다', async () => {
      const { fetchIdeas } = await loadIdeasApi('/server-api')

      await expect(fetchIdeas(undefined, new AbortController().signal)).resolves.toEqual(LIST)
    })

    it('토큰이 있으면 Authorization: Bearer를 붙여야 한다', async () => {
      const token = createToken()
      saveToken(token)
      const { fetchIdeas } = await loadIdeasApi('/server-api')

      await fetchIdeas(undefined, new AbortController().signal)

      expect(lastFetchCall().init.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    })
  })

  describe('경계', () => {
    it('signal을 fetch에 전달해야 한다', async () => {
      const controller = new AbortController()
      const { fetchIdeas } = await loadIdeasApi('/server-api')

      await fetchIdeas(undefined, controller.signal)

      expect(lastFetchCall().init.signal).toBe(controller.signal)
    })
  })

  describe('예외', () => {
    it('응답이 500이면 ApiError(500)로 거부해야 한다', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(500))
      const { fetchIdeas, ApiError } = await loadIdeasApi('/server-api')

      const error = await fetchIdeas(undefined, new AbortController().signal).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as InstanceType<typeof ApiError>).status).toBe(500)
    })

    it('네트워크 오류이면 fetch의 오류로 거부해야 한다', async () => {
      const networkError = new TypeError('Failed to fetch')
      fetchMock.mockRejectedValue(networkError)
      const { fetchIdeas } = await loadIdeasApi('/server-api')

      await expect(fetchIdeas(undefined, new AbortController().signal)).rejects.toBe(networkError)
    })
  })
})
