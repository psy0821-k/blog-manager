import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveToken } from '../../../lib/auth-token'

const fetchMock = vi.fn<typeof fetch>()

const INPUT = { title: '제목', memo: '- 메모', type: 'LAB' } as const

const SAVED = {
  id: 'idea-1',
  title: '제목',
  memo: '- 메모',
  type: 'LAB',
  status: 'todo',
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

  const { createIdea } = await import('../ideas-api')
  const { ApiError } = await import('../../../lib/api-client')

  return { createIdea, ApiError }
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
  fetchMock.mockImplementation(async () => jsonResponse(201, SAVED))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('@/lib/env')
})

describe('createIdea', () => {
  describe('정상', () => {
    it('SERVER_API_URL이 /server-api일 때 POST /server-api/ideas를 한 번 보내야 한다', async () => {
      const { createIdea } = await loadIdeasApi('/server-api')

      await createIdea(INPUT)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(lastFetchCall().url).toBe('/server-api/ideas')
      expect(lastFetchCall().init.method).toBe('POST')
    })

    it('SERVER_API_URL이 https://server.example일 때 POST https://server.example/ideas를 보내야 한다', async () => {
      const { createIdea } = await loadIdeasApi('https://server.example')

      await createIdea(INPUT)

      expect(lastFetchCall().url).toBe('https://server.example/ideas')
    })

    it('본문은 { title, memo, type }뿐이어야 한다', async () => {
      const { createIdea } = await loadIdeasApi('/server-api')

      await createIdea(INPUT)

      expect(JSON.parse(String(lastFetchCall().init.body))).toEqual({ title: '제목', memo: '- 메모', type: 'LAB' })
    })

    it('Bearer 토큰 헤더를 붙여야 한다', async () => {
      const token = createToken()
      saveToken(token)
      const { createIdea } = await loadIdeasApi('/server-api')

      await createIdea(INPUT)

      expect(lastFetchCall().init.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    })

    it('서버가 돌려준 글감을 그대로 돌려줘야 한다', async () => {
      const { createIdea } = await loadIdeasApi('/server-api')

      await expect(createIdea(INPUT)).resolves.toEqual(SAVED)
    })
  })

  describe('경계', () => {
    it('signal을 fetch에 전달해야 한다', async () => {
      const controller = new AbortController()
      const { createIdea } = await loadIdeasApi('/server-api')

      await createIdea(INPUT, controller.signal)

      expect(lastFetchCall().init.signal).toBe(controller.signal)
    })
  })

  describe('예외', () => {
    it.each([400, 500])('서버가 %i이면 ApiError(status)로 거부해야 한다', async (status) => {
      fetchMock.mockImplementation(async () => jsonResponse(status))
      const { createIdea, ApiError } = await loadIdeasApi('/server-api')

      const error = await createIdea(INPUT).catch((reason: unknown) => reason)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as InstanceType<typeof ApiError>).status).toBe(status)
    })
  })
})
