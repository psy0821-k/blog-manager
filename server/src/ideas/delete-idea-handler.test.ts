import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { signTestToken, TEST_SECRET } from '../auth/auth-test-helpers'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, IdeaRepository } from './idea-types'

const ID = '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c'

const IDEA: Idea = {
  id: ID,
  title: '제목',
  memo: '메모',
  type: 'LAB',
  status: 'doing',
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
}

/** delete가 돌려줄 값을 정하는 가짜 저장소. DB에는 연결하지 않는다. */
function createFakeRepository(deleteIdea?: IdeaRepository['delete']) {
  const fakeDelete = vi.fn(deleteIdea ?? (async () => true))
  const fakeCreate = vi.fn<IdeaRepository['create']>(async () => IDEA)
  const fakeList = vi.fn<IdeaRepository['list']>(async () => [IDEA])
  const fakeUpdate = vi.fn<IdeaRepository['update']>(async () => IDEA)

  return {
    repository: {
      create: fakeCreate,
      list: fakeList,
      update: fakeUpdate,
      delete: fakeDelete,
    } satisfies IdeaRepository,
    delete: fakeDelete,
    create: fakeCreate,
    list: fakeList,
    update: fakeUpdate,
  }
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

function deleteIdea(baseUrl: string, { token, id = ID }: { token?: string; id?: string } = {}) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${baseUrl}/ideas/${id}`, { method: 'DELETE', headers })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createDeleteIdeaHandler', () => {
  it('유효한 ADMIN 토큰과 uuid id이면 204와 빈 본문을 돌려주고 저장소 delete가 (id)로 한 번 호출돼야 한다', async () => {
    const { repository, delete: deleteFake } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token })

      expect(response.status).toBe(204)
      expect(await response.text()).toBe('')
      expect(deleteFake).toHaveBeenCalledTimes(1)
      expect(deleteFake).toHaveBeenCalledWith(ID)
    })
  })

  it('ideaRepository를 주입하지 않으면 유효한 ADMIN 토큰의 DELETE /ideas/:id도 404여야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token })

      expect(response.status).toBe(404)
    })
  })

  it('DELETE를 추가해도 GET /ideas, POST /ideas, PATCH /ideas/:id가 기존대로 동작해야 한다', async () => {
    const { repository, create, list, update } = createFakeRepository()
    const token = await signTestToken()
    const authorization = { Authorization: `Bearer ${token}` }

    await withServer(repository, async (baseUrl) => {
      const listResponse = await fetch(`${baseUrl}/ideas`, { headers: authorization })
      const createResponse = await fetch(`${baseUrl}/ideas`, {
        method: 'POST',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '제목', memo: '메모', type: 'LAB' }),
      })
      const updateResponse = await fetch(`${baseUrl}/ideas/${ID}`, {
        method: 'PATCH',
        headers: { ...authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })

      expect(listResponse.status).toBe(200)
      expect(createResponse.status).toBe(201)
      expect(updateResponse.status).toBe(200)
      expect(list).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)
      expect(update).toHaveBeenCalledTimes(1)
    })
  })

  it('토큰이 없으면 401이고 delete는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, delete: deleteFake } = createFakeRepository()

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl)

      expect(response.status).toBe(401)
      expect(deleteFake).not.toHaveBeenCalled()
    })
  })

  it('ADMIN이 아닌 토큰이면 403이고 delete는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, delete: deleteFake } = createFakeRepository()
    const token = await signTestToken({ role: 'USER' })

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token })

      expect(response.status).toBe(403)
      expect(deleteFake).not.toHaveBeenCalled()
    })
  })

  it('id가 uuid 형식이 아니면 404 IDEA_NOT_FOUND이고 delete는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, delete: deleteFake } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token, id: 'idea-1' })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ status: 'error', reason: 'IDEA_NOT_FOUND' })
      expect(deleteFake).not.toHaveBeenCalled()
    })
  })

  it('저장소가 false를 돌려주면 404 IDEA_NOT_FOUND여야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => false)
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ status: 'error', reason: 'IDEA_NOT_FOUND' })
    })
  })

  it('저장소가 MissingEnvError를 던지면 503 DATABASE_URL_MISSING이어야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new MissingEnvError('DATABASE_URL')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await deleteIdea(baseUrl, { token })

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
      const response = await deleteIdea(baseUrl, { token })

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
      const response = await deleteIdea(baseUrl, { token })
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INTERNAL_ERROR' })
      expect(text).not.toContain('leaked-password')
      expect(text).not.toContain('postgresql://')
    })
  })

  it('어떤 실패든 console.error 로그에는 reason 코드만 있고 연결 문자열·원인 오류 메시지는 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      await deleteIdea(baseUrl, { token, id: 'idea-1' })
      await deleteIdea(baseUrl, { token })
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('IDEA_NOT_FOUND')
    expect(logged).toContain('INTERNAL_ERROR')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toMatch(/postgres(ql)?:\/\//)
  })
})
