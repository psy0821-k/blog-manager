import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import { MissingEnvError } from './config/env'
import type { PingDatabase } from './db/prisma-client'

/** createApp을 임시 포트에 띄워 baseUrl과 함께 콜백을 실행하고 서버를 닫는다. */
async function withServer(pingDatabase: PingDatabase, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp({ pingDatabase }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createApp GET /health', () => {
  it('ping이 성공할 때 200과 연결 상태를 응답해야 한다', async () => {
    await withServer(async () => {}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ status: 'ok', database: 'connected' })
    })
  })

  it('ping이 실패할 때 503과 reason을 응답해야 한다', async () => {
    const ping: PingDatabase = async () => {
      throw new MissingEnvError('DATABASE_URL')
    }

    await withServer(ping, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`)

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        status: 'error',
        database: 'unavailable',
        reason: 'DATABASE_URL_MISSING',
      })
    })
  })

  it('ping이 실패한 뒤에도 서버는 죽지 않고 다음 요청에 응답해야 한다', async () => {
    const ping: PingDatabase = async () => {
      throw new Error('connection refused')
    }

    await withServer(ping, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/health`)
      const second = await fetch(`${baseUrl}/health`)

      expect(first.status).toBe(503)
      expect(second.status).toBe(503)
    })
  })

  it('실패 시 로그(console.error)에는 reason 코드만 남고 연결 문자열은 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ping: PingDatabase = async () => {
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    }

    await withServer(ping, async (baseUrl) => {
      await fetch(`${baseUrl}/health`)
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('DATABASE_UNREACHABLE')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toMatch(/postgres(ql)?:\/\//)
  })

  it('정의되지 않은 경로는 404를 응답해야 한다', async () => {
    await withServer(async () => {}, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/unknown`)

      expect(response.status).toBe(404)
    })
  })
})
