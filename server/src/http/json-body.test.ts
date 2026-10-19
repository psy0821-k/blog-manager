import express from 'express'
import type { Express } from 'express'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleBodyError, parseJsonBody } from './json-body'

/** 본문 파서와 오류 처리기만 붙인 최소 앱. 오류를 일으키는 /boom 경로를 둔다. */
function createJsonApp(): Express {
  const app = express()

  app.use(parseJsonBody)
  app.post('/echo', (req, res) => {
    res.json(req.body ?? null)
  })
  app.get('/boom', () => {
    throw new Error('boom: postgresql://user:leaked-password@host.example/db')
  })
  app.use(handleBodyError)

  return app
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createJsonApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const postJson = (baseUrl: string, body: string) =>
  fetch(`${baseUrl}/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleBodyError', () => {
  it('깨진 JSON 오류이면 400 INVALID_BODY를 응답해야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, '{"title": "깨진 JSON",')

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_BODY' })
    })
  })

  it('본문 상한 초과 오류이면 413 PAYLOAD_TOO_LARGE를 응답해야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, JSON.stringify({ memo: 'a'.repeat(20_000) }))

      expect(response.status).toBe(413)
      expect(await response.json()).toEqual({ status: 'error', reason: 'PAYLOAD_TOO_LARGE' })
    })
  })

  it('알 수 없는 오류이면 500 INTERNAL_ERROR를 응답하고 스택·오류 메시지를 응답에 담지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/boom`)
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INTERNAL_ERROR' })
      expect(text).not.toContain('leaked-password')
      expect(text).not.toContain('postgresql://')
      expect(text).not.toContain('at ')
    })
  })

  it('어떤 오류든 로그에는 reason 코드만 남아야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    await withServer(async (baseUrl) => {
      await postJson(baseUrl, '{"title": "LEAK-FRAGMENT",')
      await postJson(baseUrl, JSON.stringify({ memo: 'a'.repeat(20_000) }))
      await fetch(`${baseUrl}/boom`)
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('INVALID_BODY')
    expect(logged).toContain('PAYLOAD_TOO_LARGE')
    expect(logged).toContain('INTERNAL_ERROR')
    expect(logged).not.toContain('LEAK-FRAGMENT')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toContain('boom')
  })
})
