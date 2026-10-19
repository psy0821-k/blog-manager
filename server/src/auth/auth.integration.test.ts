import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import type { PingDatabase } from '../db/prisma-client'
import { createNoneAlgToken, nowSeconds, OTHER_SECRET, signTestToken, TEST_SECRET } from './auth-test-helpers'

/** createApp을 임시 포트에 띄워 baseUrl과 함께 콜백을 실행하고 서버를 닫는다. */
async function withServer(
  run: (baseUrl: string) => Promise<void>,
  pingDatabase: PingDatabase = async () => {},
): Promise<void> {
  const server = createServer(createApp({ pingDatabase, authSecret: TEST_SECRET }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createApp 인증', () => {
  it('유효한 ADMIN 토큰으로 GET /auth/check이면 200과 { status: ok }를 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ status: 'ok' })
    })
  })

  it('GET /health는 인증 없이 200을 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      expect(response.status).toBe(200)
    })
  })

  it('유효한 ADMIN 토큰으로 정의되지 않은 경로이면 404를 응답해야 한다', async () => {
    const token = await signTestToken()

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/unknown`, bearer(token))

      expect(response.status).toBe(404)
    })
  })

  it('Authorization 헤더 없이 GET /auth/check이면 401 TOKEN_MISSING과 WWW-Authenticate: Bearer를 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`)

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe('Bearer')
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_MISSING' })
    })
  })

  it('Bearer 형식이 아니면 401 TOKEN_MISSING을 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, { headers: { Authorization: 'Basic xxx' } })

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_MISSING' })
    })
  })

  it('토큰 없이 정의되지 않은 경로이면 401을 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/unknown`)

      expect(response.status).toBe(401)
    })
  })

  it('토큰 없이 POST /health이면 401을 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`, { method: 'POST' })

      expect(response.status).toBe(401)
    })
  })

  it('서명이 다른 토큰이면 401 TOKEN_INVALID를 응답해야 한다', async () => {
    const token = await signTestToken({ secret: OTHER_SECRET })

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_INVALID' })
    })
  })

  it('alg none 토큰이면 401 TOKEN_INVALID를 응답해야 한다', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(createNoneAlgToken()))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_INVALID' })
    })
  })

  it('만료된 토큰이면 401 TOKEN_EXPIRED를 응답해야 한다', async () => {
    const token = await signTestToken({ expiresAt: nowSeconds() - 60 })

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ status: 'error', reason: 'TOKEN_EXPIRED' })
    })
  })

  it('role이 ADMIN이 아닌 토큰이면 403 FORBIDDEN을 응답해야 한다', async () => {
    const token = await signTestToken({ role: 'USER' })

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auth/check`, bearer(token))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ status: 'error', reason: 'FORBIDDEN' })
    })
  })

  it('인증 실패 시 응답과 console.error 로그에 토큰, secret, 원인 메시지가 없고 reason만 있어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cases: Array<{ token: string | null; reason: string }> = [
      { token: null, reason: 'TOKEN_MISSING' },
      { token: await signTestToken({ secret: OTHER_SECRET }), reason: 'TOKEN_INVALID' },
      { token: await signTestToken({ expiresAt: nowSeconds() - 60 }), reason: 'TOKEN_EXPIRED' },
      { token: await signTestToken({ role: 'USER' }), reason: 'FORBIDDEN' },
    ]

    await withServer(async (baseUrl) => {
      for (const { token, reason } of cases) {
        errorLog.mockClear()
        const response = await fetch(`${baseUrl}/auth/check`, token ? bearer(token) : undefined)
        const text = await response.text()
        const logged = errorLog.mock.calls.flat().map(String).join(' ')

        expect(JSON.parse(text)).toEqual({ status: 'error', reason })
        expect(logged).toContain(reason)

        // 토큰·secret·jose 원인 메시지 조각이 응답과 로그에 새면 안 된다
        const leakedValues = [TEST_SECRET, OTHER_SECRET, 'signature', 'JWS', 'JWT', 'exp']
        if (token) leakedValues.push(token)
        for (const leaked of leakedValues) {
          expect(text).not.toContain(leaked)
          expect(logged).not.toContain(leaked)
        }
      }
    })
  })

  it('연속으로 인증이 실패해도 서버가 죽지 않고 다음 요청에 응답해야 한다', async () => {
    const validToken = await signTestToken()

    await withServer(async (baseUrl) => {
      const first = await fetch(`${baseUrl}/auth/check`)
      const second = await fetch(`${baseUrl}/auth/check`, bearer('abc'))
      const third = await fetch(`${baseUrl}/auth/check`, bearer(validToken))

      expect([first.status, second.status, third.status]).toEqual([401, 401, 200])
    })
  })
})
