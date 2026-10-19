import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { createNoneAlgToken, signTestToken, TEST_SECRET } from './auth-test-helpers'

/** authSecret을 지정해 createApp을 임시 포트에 띄우고 콜백 실행 뒤 서버를 닫는다. */
async function withServer(authSecret: string | undefined, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp({ pingDatabase: async () => {}, authSecret }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const NOT_CONFIGURED_BODY = { status: 'error', reason: 'AUTH_NOT_CONFIGURED' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('인증 미설정 가드', () => {
  it('authSecret이 undefined이고 유효해 보이는 토큰으로 GET /auth/check이면 503과 AUTH_NOT_CONFIGURED를 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('authSecret을 TEST_SECRET으로 주고 유효한 ADMIN 토큰으로 GET /auth/check이면 200을 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer(TEST_SECRET, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(200)
    })
  })

  it('authSecret이 빈 문자열이고 토큰이 있으면 503 AUTH_NOT_CONFIGURED를 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer('', async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('authSecret이 공백뿐이면 503 AUTH_NOT_CONFIGURED를 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer('   ', async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('Authorization 헤더가 없어도 401 TOKEN_MISSING이 아니라 503 AUTH_NOT_CONFIGURED를 응답해야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`)

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('정의되지 않은 경로 /unknown을 호출하면 404가 아니라 503 AUTH_NOT_CONFIGURED를 응답해야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/unknown`)

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('공백 키로 서명한 ADMIN 토큰으로 보호 경로를 호출해도 통과하지 않고 503이어야 한다', async () => {
    const token = await signTestToken({ secret: '   ' })

    await withServer('   ', async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('alg none 토큰으로 보호 경로를 호출해도 통과하지 않고 503이어야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(createNoneAlgToken()))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_BODY)
    })
  })

  it('503 응답에는 WWW-Authenticate 헤더가 없어야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`)

      expect(response.status).toBe(503)
      expect(response.headers.get('www-authenticate')).toBeNull()
    })
  })

  it('authSecret이 없어도 GET /health는 인증 없이 응답해야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      // 가드가 막았다면 { status, reason }만 있고 database 필드가 없다
      expect(await response.json()).toHaveProperty('database')
    })
  })

  it('인증 미설정에서 토큰을 보내면 console.error 로그에 AUTH_NOT_CONFIGURED만 남고 토큰 값은 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))
      const text = await response.text()
      const logged = errorLog.mock.calls.flat().map(String).join(' ')

      expect(logged).toContain('AUTH_NOT_CONFIGURED')
      expect(logged).not.toContain(token)
      expect(text).not.toContain(token)
    })
  })

  it('인증 미설정에서 연속 호출해도 서버가 죽지 않고 다음 요청에도 503으로 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/auth/check`)
      const second = await fetch(`${baseUrl}/auth/check`, bearer('abc'))
      const third = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect([first.status, second.status, third.status]).toEqual([503, 503, 503])
    })
  })
})
