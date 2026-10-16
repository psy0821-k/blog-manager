import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet } from '../api-client'
import * as authRedirect from '../auth-redirect'
import { getToken, saveToken } from '../auth-token'

vi.mock('../env', () => ({
  BLOG_API_URL: 'http://blog.test',
  BLOG_LOGIN_URL: 'http://localhost:3000/admin-login',
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

function stubLocation(pathname: string, search = '') {
  vi.stubGlobal('location', { pathname, search, origin: 'http://localhost:5173', assign })
}

beforeEach(() => {
  sessionStorage.clear()
  mockedRedirect.mockReset()
  assign.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  stubLocation('/manage', '?page=2')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet 401/403 처리', () => {
  it('응답이 401이면 저장된 토큰을 지워야 한다', async () => {
    saveToken(createToken())
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('응답이 401이면 redirectToBlogLogin을 현재 경로(pathname+search)로 한 번 호출해야 한다', async () => {
    saveToken(createToken())
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
    expect(mockedRedirect).toHaveBeenCalledWith('/manage?page=2')
  })

  it('응답이 403이면 저장된 토큰을 지우고 redirectToBlogLogin을 호출해야 한다', async () => {
    saveToken(createToken())
    fetchMock.mockResolvedValue(jsonResponse(403))

    await apiGet('/api/projects').catch(() => {})

    expect(sessionStorage.length).toBe(0)
    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })

  it('응답이 401이면 status가 401인 ApiError로 reject되어야 한다', async () => {
    saveToken(createToken())
    fetchMock.mockImplementation(async () => jsonResponse(401))

    await expect(apiGet('/api/projects')).rejects.toMatchObject({ status: 401 })
    await expect(apiGet('/api/projects')).rejects.toBeInstanceOf(ApiError)
  })

  it('쿼리 없는 경로(/)에서 401을 받으면 redirectToBlogLogin을 /로 호출해야 한다', async () => {
    stubLocation('/', '')
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(mockedRedirect).toHaveBeenCalledWith('/')
  })

  it('토큰이 없는 상태에서 401을 받아도 redirectToBlogLogin을 호출하고 ApiError로 reject되어야 한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401))

    await expect(apiGet('/api/projects')).rejects.toBeInstanceOf(ApiError)

    expect(mockedRedirect).toHaveBeenCalledTimes(1)
  })

  it('토큰이 없는 상태의 성공 응답(200)은 재로그인 없이 JSON을 반환하고 Authorization 헤더는 붙지 않아야 한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    const result = await apiGet('/api/projects')

    expect(result).toEqual({ ok: true })
    expect(mockedRedirect).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined()
  })

  it('응답이 404이면 토큰을 지우지 않고 redirectToBlogLogin도 호출하지 않으며 ApiError(404)로 reject되어야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockResolvedValue(jsonResponse(404))

    await expect(apiGet('/api/projects')).rejects.toMatchObject({ status: 404 })

    expect(getToken()).toBe(token)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('응답이 500이면 토큰을 지우지 않고 redirectToBlogLogin도 호출하지 않아야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockResolvedValue(jsonResponse(500))

    await apiGet('/api/projects').catch(() => {})

    expect(getToken()).toBe(token)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('fetch가 네트워크 오류로 reject되면 토큰을 지우지 않고 redirectToBlogLogin도 호출하지 않아야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockRejectedValue(new TypeError('network'))

    await expect(apiGet('/api/projects')).rejects.toBeInstanceOf(TypeError)

    expect(getToken()).toBe(token)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('성공 응답(200)이면 JSON을 반환하고 토큰을 유지하며 redirectToBlogLogin을 호출하지 않아야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [1] }))

    const result = await apiGet('/api/projects')

    expect(result).toEqual({ data: [1] })
    expect(getToken()).toBe(token)
    expect(mockedRedirect).not.toHaveBeenCalled()
  })

  it('유효한 토큰이 있으면 Authorization: Bearer 헤더를 실어 요청해야 한다', async () => {
    const token = createToken()
    saveToken(token)
    fetchMock.mockResolvedValue(jsonResponse(200))

    await apiGet('/api/projects')

    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: `Bearer ${token}` })
  })
})

describe('apiGet과 실제 auth-redirect 연결', () => {
  const EXPECTED_LOGIN_URL = `http://localhost:3000/admin-login?redirect=${encodeURIComponent('http://localhost:5173/auth/callback')}`

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('../auth-redirect')>('../auth-redirect')

    actual.resetRedirectState()
    mockedRedirect.mockImplementation(actual.redirectToBlogLogin)
  })

  it('401을 받으면 window.location.assign이 블로그 로그인 주소(?redirect=<origin>/auth/callback)로 한 번 호출되어야 한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(EXPECTED_LOGIN_URL)
  })

  it('동시에 3개 요청이 모두 401을 받아도 window.location.assign은 한 번만 호출되어야 한다', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(401))

    await Promise.allSettled([apiGet('/api/projects'), apiGet('/api/lab'), apiGet('/api/devlog')])

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('동시에 401과 403이 섞여 도착해도 assign은 한 번만 호출되어야 한다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(403))
      .mockResolvedValueOnce(jsonResponse(401))

    await Promise.allSettled([apiGet('/api/projects'), apiGet('/api/lab'), apiGet('/api/devlog')])

    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('동시 401 중 일부가 성공(200)이어도 assign은 한 번만 호출되고 성공한 요청은 결과를 반환해야 한다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }))
      .mockResolvedValueOnce(jsonResponse(401))

    const results = await Promise.allSettled([apiGet('/api/projects'), apiGet('/api/lab'), apiGet('/api/devlog')])

    expect(assign).toHaveBeenCalledTimes(1)
    expect(results[1]).toEqual({ status: 'fulfilled', value: { data: 'ok' } })
  })

  it('/manage?page=2에서 401을 받은 뒤 takeReturnPath()가 /manage?page=2를 반환해야 한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(authRedirect.takeReturnPath()).toBe('/manage?page=2')
  })

  it('현재 경로가 /login일 때 401을 받으면 takeReturnPath()가 /를 반환해야 한다', async () => {
    stubLocation('/login', '')
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(assign).toHaveBeenCalledTimes(1)
    expect(authRedirect.takeReturnPath()).toBe('/')
  })

  it('현재 경로가 /auth/callback일 때 401을 받으면 takeReturnPath()가 /를 반환해야 한다', async () => {
    stubLocation('/auth/callback', '')
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})

    expect(assign).toHaveBeenCalledTimes(1)
    expect(authRedirect.takeReturnPath()).toBe('/')
  })

  it('동시 401들 사이에 경로가 바뀌어도 복귀 경로는 첫 호출 시점의 경로 하나만 저장되어야 한다', async () => {
    let call = 0
    fetchMock.mockImplementation(async () => {
      call += 1
      // 첫 응답 이후 경로가 바뀐 것처럼 만든다
      if (call > 1) {
        stubLocation('/other', '')
      }
      return jsonResponse(401)
    })

    await Promise.allSettled([apiGet('/api/projects'), apiGet('/api/lab'), apiGet('/api/devlog')])

    expect(assign).toHaveBeenCalledTimes(1)
    expect(authRedirect.takeReturnPath()).toBe('/manage?page=2')
  })

  it('직전 재로그인으로부터 30초 안에 다시 403을 받으면 토큰만 지우고 assign은 호출하지 않아야 한다', async () => {
    authRedirect.redirectToBlogLogin('/manage')
    authRedirect.resetRedirectState()
    assign.mockClear()
    saveToken(createToken())
    fetchMock.mockResolvedValue(jsonResponse(403))

    await expect(apiGet('/api/projects')).rejects.toMatchObject({ status: 403 })

    expect(assign).not.toHaveBeenCalled()
    expect(getToken()).toBeNull()
  })

  it('30초 안에 연속으로 거부돼도 에러는 그대로 reject되어 화면이 오류를 표시할 수 있어야 한다', async () => {
    authRedirect.redirectToBlogLogin('/manage')
    authRedirect.resetRedirectState()
    fetchMock.mockResolvedValue(jsonResponse(401))

    await expect(apiGet('/api/projects')).rejects.toBeInstanceOf(ApiError)
  })

  it('직전 재로그인으로부터 30초가 지난 뒤의 403은 정상적으로 재로그인해야 한다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'))
    authRedirect.redirectToBlogLogin('/manage')
    authRedirect.resetRedirectState()
    assign.mockClear()
    vi.setSystemTime(new Date('2026-10-16T12:00:31Z'))
    saveToken(createToken())
    fetchMock.mockResolvedValue(jsonResponse(403))

    await apiGet('/api/projects').catch(() => {})

    expect(assign).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('401로 redirectToBlogLogin이 이미 호출된 뒤 화면 가드가 다시 호출해도 assign은 총 한 번이어야 한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401))

    await apiGet('/api/projects').catch(() => {})
    authRedirect.redirectToBlogLogin('/manage')

    expect(assign).toHaveBeenCalledTimes(1)
  })
})
