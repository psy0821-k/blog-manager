import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { signTestToken, TEST_SECRET } from '../auth/auth-test-helpers'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, IdeaRepository, NewIdea } from './idea-types'

const SAVED_AT = new Date('2026-10-19T00:00:00.000Z')

const validBody = { title: '제목', memo: '메모', type: 'LAB' }

/** create가 받은 값에 id·status·createdAt을 붙여 돌려주는 가짜 저장소. DB에는 연결하지 않는다. */
function createFakeRepository(create?: IdeaRepository['create']) {
  const fake = vi.fn(
    create ??
      (async (idea: NewIdea): Promise<Idea> => ({ id: 'idea-1', ...idea, status: 'todo', createdAt: SAVED_AT })),
  )

  return { repository: { create: fake } satisfies IdeaRepository, create: fake }
}

/** createApp을 임시 포트에 띄워 baseUrl과 함께 콜백을 실행하고 서버를 닫는다. */
async function withServer(
  ideaRepository: IdeaRepository | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(createApp({ pingDatabase: async () => {}, authSecret: TEST_SECRET, ideaRepository }))
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

interface PostOptions {
  token?: string
  /** 문자열이면 그대로, 객체면 JSON으로 직렬화해 보낸다 */
  body?: unknown
  contentType?: string
}

function postIdea(baseUrl: string, { token, body, contentType = 'application/json' }: PostOptions = {}) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = contentType

  return fetch(`${baseUrl}/ideas`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createIdeaHandler', () => {
  it('유효한 ADMIN 토큰과 유효한 본문이면 201과 글감을 응답하고 저장소 create가 정확히 한 번 호출돼야 한다', async () => {
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        id: 'idea-1',
        title: '제목',
        memo: '메모',
        type: 'LAB',
        status: 'todo',
        createdAt: SAVED_AT.toISOString(),
      })
      expect(create).toHaveBeenCalledTimes(1)
    })
  })

  it('저장소 create에는 { title, memo, type }만 전달되고 저장소가 돌려준 status: todo가 응답돼야 한다', async () => {
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(create).toHaveBeenCalledWith({ title: '제목', memo: '메모', type: 'LAB' })
      const body = (await response.json()) as { status: string }
      expect(body.status).toBe('todo')
    })
  })

  it('본문에 status: done을 담아 보내도 create에 status가 전달되지 않고 응답 status는 todo여야 한다', async () => {
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: { ...validBody, status: 'done' } })

      expect(response.status).toBe(201)
      expect(create).toHaveBeenCalledWith({ title: '제목', memo: '메모', type: 'LAB' })
      const body = (await response.json()) as { status: string }
      expect(body.status).toBe('todo')
    })
  })

  it('title 앞뒤 공백은 제거한 값이 create에 전달돼야 한다', async () => {
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      await postIdea(baseUrl, { token, body: { ...validBody, title: '  제목  ' } })

      expect(create).toHaveBeenCalledWith({ title: '제목', memo: '메모', type: 'LAB' })
    })
  })

  it('memo를 생략하면 빈 문자열이 create에 전달돼야 한다', async () => {
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: { title: '제목', type: 'LAB' } })

      expect(response.status).toBe(201)
      expect(create).toHaveBeenCalledWith({ title: '제목', memo: '', type: 'LAB' })
    })
  })

  it.each([
    { field: 'title', body: { ...validBody, title: '   ' }, reason: 'INVALID_TITLE' },
    { field: 'memo', body: { ...validBody, memo: 'a'.repeat(2001) }, reason: 'INVALID_MEMO' },
    { field: 'type', body: { ...validBody, type: 'OTHER' }, reason: 'INVALID_TYPE' },
  ])('$field 필드가 잘못되면 400($reason)이고 create는 호출되지 않아야 한다', async ({ body, reason }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason })
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('본문이 없으면 400 INVALID_BODY이고 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('Content-Type이 JSON이 아니면 400 INVALID_BODY이고 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, {
        token,
        body: JSON.stringify(validBody),
        contentType: 'text/plain',
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('본문이 깨진 JSON이면 400 INVALID_BODY이고 응답에 본문 조각이 없으며 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: '{"title": "LEAK-FRAGMENT",' })
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(text).not.toContain('LEAK-FRAGMENT')
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('본문이 16kb를 넘으면 413 PAYLOAD_TOO_LARGE이고 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: { ...validBody, memo: 'a'.repeat(20_000) } })

      expect(response.status).toBe(413)
      expect(await response.json()).toEqual({ status: 'error', reason: 'PAYLOAD_TOO_LARGE' })
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('토큰이 없으면 401이고 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { body: validBody })

      expect(response.status).toBe(401)
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('ADMIN이 아닌 토큰이면 403이고 create는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()
    const token = await signTestToken({ role: 'USER' })

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(response.status).toBe(403)
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('토큰이 없고 본문도 깨져 있으면 본문 오류가 아니라 401이어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, create } = createFakeRepository()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { body: '{깨진 JSON' })

      expect(response.status).toBe(401)
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('저장소가 MissingEnvError를 던지면 503 DATABASE_URL_MISSING이어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new MissingEnvError('DATABASE_URL')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ status: 'error', reason: 'DATABASE_URL_MISSING' })
    })
  })

  it('저장소가 DatabaseUnreachableError를 던지면 503 DATABASE_UNREACHABLE이어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new DatabaseUnreachableError()
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ status: 'error', reason: 'DATABASE_UNREACHABLE' })
    })
  })

  it('저장소가 그 밖의 오류를 던지면 500 INTERNAL_ERROR이고 응답에 오류 메시지가 없어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INTERNAL_ERROR' })
      expect(text).not.toContain('leaked-password')
      expect(text).not.toContain('postgresql://')
    })
  })

  it('어떤 실패든 console.error 로그에는 reason 코드만 있고 제목·메모·연결 문자열·원인 오류 메시지는 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const leakingBody = { title: 'LEAK-TITLE', memo: 'LEAK-MEMO', type: 'LAB' }
    const { repository } = createFakeRepository(async () => {
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      // 검증 실패: 제목·메모가 본문에 있어도 로그에 남지 않아야 한다
      await postIdea(baseUrl, { token, body: { ...leakingBody, type: 'OTHER' } })
      // 저장 실패: 원인 오류 메시지(연결 문자열)가 로그에 남지 않아야 한다
      await postIdea(baseUrl, { token, body: leakingBody })
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('INVALID_TYPE')
    expect(logged).toContain('INTERNAL_ERROR')
    expect(logged).not.toContain('LEAK-TITLE')
    expect(logged).not.toContain('LEAK-MEMO')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toMatch(/postgres(ql)?:\/\//)
  })

  it('ideaRepository를 주입하지 않으면 유효한 ADMIN 토큰의 POST /ideas도 404여야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await postIdea(baseUrl, { token, body: validBody })

      expect(response.status).toBe(404)
    })
  })

  it('POST /ideas를 추가해도 GET /health는 토큰 없이 응답하고 GET /auth/check는 기존대로 동작해야 한다', async () => {
    const { repository } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`)
      const check = await fetch(`${baseUrl}/auth/check`, { headers: { Authorization: `Bearer ${token}` } })
      const unauthorized = await fetch(`${baseUrl}/auth/check`)

      expect(health.status).toBe(200)
      expect(check.status).toBe(200)
      expect(unauthorized.status).toBe(401)
    })
  })
})
