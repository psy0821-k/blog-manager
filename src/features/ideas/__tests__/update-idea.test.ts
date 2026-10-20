import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveToken } from '../../../lib/auth-token'

const fetchMock = vi.fn<typeof fetch>()

const UPDATED = {
  id: 'idea-1',
  title: '제목',
  memo: '- 메모',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

/** SERVER_API_URL을 바꿔 가며 확인하려고 모듈 캐시를 비우고 env를 대체한 뒤 불러온다. */
async function loadIdeasApi(serverApiUrl: string) {
  vi.resetModules()
  vi.doMock('@/lib/env', () => ({
    BLOG_API_URL: 'http://blog.test',
    BLOG_LOGIN_URL: 'http://localhost:3000/admin-login',
    SERVER_API_URL: serverApiUrl,
  }))

  const { updateIdea } = await import('../ideas-api')
  const { ApiError } = await import('../../../lib/api-client')

  return { updateIdea, ApiError }
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
  fetchMock.mockImplementation(async () => jsonResponse(200, UPDATED))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/env')
})

describe('updateIdea', () => {
  describe('정상', () => {
    it('PATCH SERVER_API_URL/ideas/<id>를 { status } 본문과 Bearer 토큰으로 요청하고 응답 글감을 돌려줘야 한다', async () => {
      const token = createToken()
      saveToken(token)
      const { updateIdea } = await loadIdeasApi('/server-api')

      await expect(updateIdea('idea-1', { status: 'doing' })).resolves.toEqual(UPDATED)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(lastFetchCall().url).toBe('/server-api/ideas/idea-1')
      expect(lastFetchCall().init.method).toBe('PATCH')
      expect(JSON.parse(String(lastFetchCall().init.body))).toEqual({ status: 'doing' })
      expect(lastFetchCall().init.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    })
  })

  describe('경계', () => {
    it('id에 특수문자가 있으면 encodeURIComponent로 인코딩해야 한다', async () => {
      const { updateIdea } = await loadIdeasApi('https://server.example')

      await updateIdea('a/b?c', { status: 'done' })

      expect(lastFetchCall().url).toBe('https://server.example/ideas/a%2Fb%3Fc')
    })

    it('signal을 fetch에 전달해야 한다', async () => {
      const controller = new AbortController()
      const { updateIdea } = await loadIdeasApi('/server-api')

      await updateIdea('idea-1', { status: 'done' }, controller.signal)

      expect(lastFetchCall().init.signal).toBe(controller.signal)
    })
  })

  describe('예외', () => {
    it.each([400, 404, 500])('서버가 %i이면 ApiError(status)로 거부해야 한다', async (status) => {
      fetchMock.mockImplementation(async () => jsonResponse(status))
      const { updateIdea, ApiError } = await loadIdeasApi('/server-api')

      const error = await updateIdea('idea-1', { status: 'doing' }).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as InstanceType<typeof ApiError>).status).toBe(status)
    })

    it('네트워크 오류이면 fetch의 오류로 거부해야 한다', async () => {
      const networkError = new TypeError('Failed to fetch')
      fetchMock.mockRejectedValue(networkError)
      const { updateIdea } = await loadIdeasApi('/server-api')

      await expect(updateIdea('idea-1', { status: 'doing' })).rejects.toBe(networkError)
    })
  })
})
