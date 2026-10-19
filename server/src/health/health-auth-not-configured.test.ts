import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { readAuthSecret } from '../auth/read-auth-secret'

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

const NOT_CONFIGURED_HEALTH_BODY = {
  status: 'error',
  database: 'connected',
  reason: 'AUTH_NOT_CONFIGURED',
  auth: 'not_configured',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('인증 미설정 GET /health', () => {
  it('createApp에 authSecret이 없으면 인증 헤더 없이 503 body를 응답해야 한다', async () => {
    await withServer(undefined, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_HEALTH_BODY)
    })
  })

  it('인증 미설정 /health 호출 시 로그에 AUTH_NOT_CONFIGURED가 있고 연결 문자열은 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(undefined, async (baseUrl) => {
      await fetch(`${baseUrl}/health`)
      const logged = errorLog.mock.calls.flat().map(String).join(' ')

      expect(logged).toContain('AUTH_NOT_CONFIGURED')
      expect(logged).not.toMatch(/postgres(ql)?:\/\//)
    })
  })

  it('공백 키가 주어져도 body 직렬화에 그 값이 없어야 한다', async () => {
    const secret = '   '

    await withServer(secret, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)
      const text = await response.text()

      expect(response.status).toBe(503)
      expect(JSON.parse(text)).toEqual(NOT_CONFIGURED_HEALTH_BODY)
      expect(text).not.toContain(secret)
    })
  })

  it('readAuthSecret({}) 결과를 createApp에 넘겨 띄우면 서버가 listen하고 GET /health에 503을 응답해야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const authSecret = readAuthSecret({})

    await withServer(authSecret, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual(NOT_CONFIGURED_HEALTH_BODY)
    })
  })
})
