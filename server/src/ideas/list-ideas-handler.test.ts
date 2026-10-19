import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { signTestToken, TEST_SECRET } from '../auth/auth-test-helpers'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, IdeaRepository } from './idea-types'

const IDEA_A: Idea = {
  id: 'idea-a',
  title: '최근에 고친 글감',
  memo: '메모 A',
  type: 'LAB',
  status: 'doing',
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
}

const IDEA_B: Idea = {
  id: 'idea-b',
  title: '오래된 글감',
  memo: '',
  type: 'DEV_LOG',
  status: 'todo',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
}

/** list가 돌려줄 값을 정하는 가짜 저장소. DB에는 연결하지 않는다. */
function createFakeRepository(list?: IdeaRepository['list']) {
  const fakeList = vi.fn(list ?? (async () => [IDEA_A, IDEA_B]))
  const fakeCreate = vi.fn<IdeaRepository['create']>(async () => {
    throw new Error('GET /ideas는 create를 부르지 않는다')
  })

  return { repository: { create: fakeCreate, list: fakeList, update: async () => null, delete: async () => false } satisfies IdeaRepository, list: fakeList, create: fakeCreate }
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

function getIdeas(baseUrl: string, { token, query = '' }: { token?: string; query?: string } = {}) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${baseUrl}/ideas${query}`, { headers })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createListIdeasHandler', () => {
  it('유효한 ADMIN 토큰이면 200과 { data }를 돌려주고 각 항목은 id, title, memo, type, status, createdAt(ISO)이어야 한다', async () => {
    const { repository, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        data: [
          {
            id: 'idea-a',
            title: '최근에 고친 글감',
            memo: '메모 A',
            type: 'LAB',
            status: 'doing',
            createdAt: '2026-10-19T00:00:00.000Z',
          },
          {
            id: 'idea-b',
            title: '오래된 글감',
            memo: '',
            type: 'DEV_LOG',
            status: 'todo',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      })
      expect(list).toHaveBeenCalledTimes(1)
    })
  })

  it('저장소가 준 순서를 그대로 유지해야 한다', async () => {
    const { repository } = createFakeRepository(async () => [IDEA_B, IDEA_A])
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })
      const body = (await response.json()) as { data: { id: string }[] }

      expect(body.data.map(({ id }) => id)).toEqual(['idea-b', 'idea-a'])
    })
  })

  it('status 쿼리가 없으면 저장소 list에 빈 필터를 넘겨야 한다', async () => {
    const { repository, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      await getIdeas(baseUrl, { token })

      expect(list).toHaveBeenCalledWith({})
    })
  })

  it('?status=doing이면 저장소 list에 { status: "doing" }을 넘겨야 한다', async () => {
    const { repository, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token, query: '?status=doing' })

      expect(response.status).toBe(200)
      expect(list).toHaveBeenCalledWith({ status: 'doing' })
    })
  })

  it('글감이 없으면 { data: [] }를 돌려줘야 한다', async () => {
    const { repository } = createFakeRepository(async () => [])
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ data: [] })
    })
  })

  it('저장소 행에 updatedAt이 있어도 응답에는 싣지 않아야 한다', async () => {
    const rowWithUpdatedAt = { ...IDEA_A, updatedAt: new Date('2026-10-20T00:00:00.000Z') }
    const { repository } = createFakeRepository(async () => [rowWithUpdatedAt])
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toContain('idea-a')
      expect(text).not.toContain('updatedAt')
      expect(text).not.toContain('2026-10-20')
    })
  })

  it('ideaRepository를 주입하지 않으면 유효한 ADMIN 토큰의 GET /ideas도 404여야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })

      expect(response.status).toBe(404)
    })
  })

  it('토큰이 없으면 401이고 저장소 list는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, list } = createFakeRepository()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl)

      expect(response.status).toBe(401)
      expect(list).not.toHaveBeenCalled()
    })
  })

  it('ADMIN이 아닌 토큰이면 403이고 저장소 list는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, list } = createFakeRepository()
    const token = await signTestToken({ role: 'USER' })

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })

      expect(response.status).toBe(403)
      expect(list).not.toHaveBeenCalled()
    })
  })

  it('허용되지 않은 status면 400 INVALID_STATUS이고 저장소 list는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token, query: '?status=archived' })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_STATUS' })
      expect(list).not.toHaveBeenCalled()
    })
  })

  it('status가 여러 번 오면 400 INVALID_STATUS여야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token, query: '?status=todo&status=done' })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_STATUS' })
      expect(list).not.toHaveBeenCalled()
    })
  })

  it('저장소가 MissingEnvError를 던지면 503 DATABASE_URL_MISSING이어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new MissingEnvError('DATABASE_URL')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await getIdeas(baseUrl, { token })

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
      const response = await getIdeas(baseUrl, { token })

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
      const response = await getIdeas(baseUrl, { token })
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INTERNAL_ERROR' })
      expect(text).not.toContain('leaked-password')
      expect(text).not.toContain('postgresql://')
    })
  })

  it('어떤 실패든 console.error 로그에는 reason 코드만 있고 제목·메모·연결 문자열·원인 오류 메시지는 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const leakingIdea: Idea = { ...IDEA_A, title: 'LEAK-TITLE', memo: 'LEAK-MEMO' }
    const { repository } = createFakeRepository(async ({ status }) => {
      if (status === 'done') return [leakingIdea]
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      await getIdeas(baseUrl, { token, query: '?status=archived' })
      await getIdeas(baseUrl, { token, query: '?status=doing' })
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('INVALID_STATUS')
    expect(logged).toContain('INTERNAL_ERROR')
    expect(logged).not.toContain('LEAK-TITLE')
    expect(logged).not.toContain('LEAK-MEMO')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toMatch(/postgres(ql)?:\/\//)
  })

  it('GET /ideas를 추가해도 POST /ideas는 기존대로 동작해야 한다', async () => {
    const { repository, create } = createFakeRepository()
    create.mockImplementation(async (idea) => ({ id: 'idea-new', ...idea, status: 'todo', createdAt: IDEA_A.createdAt }))
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ideas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '제목', memo: '메모', type: 'LAB' }),
      })

      expect(response.status).toBe(201)
      expect(create).toHaveBeenCalledTimes(1)
    })
  })
})
