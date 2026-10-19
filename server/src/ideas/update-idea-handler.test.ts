import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'
import { signTestToken, TEST_SECRET } from '../auth/auth-test-helpers'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, IdeaRepository } from './idea-types'

const ID = '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c'

const UPDATED: Idea = {
  id: ID,
  title: '제목',
  memo: '메모',
  type: 'LAB',
  status: 'doing',
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
}

/** update가 돌려줄 값을 정하는 가짜 저장소. DB에는 연결하지 않는다. */
function createFakeRepository(update?: IdeaRepository['update']) {
  const fakeUpdate = vi.fn(update ?? (async () => UPDATED))
  const fakeCreate = vi.fn<IdeaRepository['create']>(async () => UPDATED)
  const fakeList = vi.fn<IdeaRepository['list']>(async () => [UPDATED])

  return {
    repository: { create: fakeCreate, list: fakeList, update: fakeUpdate, delete: async () => false } satisfies IdeaRepository,
    update: fakeUpdate,
    create: fakeCreate,
    list: fakeList,
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

interface PatchOptions {
  token?: string
  id?: string
  /** 문자열이면 그대로, 객체면 JSON으로 직렬화해 보낸다 */
  body?: unknown
  contentType?: string
}

function patchIdea(baseUrl: string, { token, id = ID, body, contentType = 'application/json' }: PatchOptions = {}) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = contentType

  return fetch(`${baseUrl}/ideas/${id}`, {
    method: 'PATCH',
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createUpdateIdeaHandler', () => {
  it('유효한 ADMIN 토큰과 { status: "doing" }이면 200과 수정된 글감을 돌려주고 update가 (id, { status: "doing" })로 한 번 호출돼야 한다', async () => {
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        id: ID,
        title: '제목',
        memo: '메모',
        type: 'LAB',
        status: 'doing',
        createdAt: '2026-10-19T00:00:00.000Z',
      })
      expect(update).toHaveBeenCalledTimes(1)
      expect(update).toHaveBeenCalledWith(ID, { status: 'doing' })
    })
  })

  it('저장소 행에 updatedAt이 있어도 응답에는 싣지 않아야 한다', async () => {
    const rowWithUpdatedAt = { ...UPDATED, updatedAt: new Date('2026-10-20T00:00:00.000Z') }
    const { repository } = createFakeRepository(async () => rowWithUpdatedAt)
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toContain(ID)
      expect(text).not.toContain('updatedAt')
      expect(text).not.toContain('2026-10-20')
    })
  })

  it('title 앞뒤 공백이 제거된 값이 update에 전달돼야 한다', async () => {
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      await patchIdea(baseUrl, { token, body: { title: '  새 제목  ' } })

      expect(update).toHaveBeenCalledWith(ID, { title: '새 제목' })
    })
  })

  it('알 수 없는 필드를 같이 보내도 update에는 아는 필드만 전달돼야 한다', async () => {
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'done', id: 'other', createdAt: '2020-01-01' } })

      expect(response.status).toBe(200)
      expect(update).toHaveBeenCalledWith(ID, { status: 'done' })
    })
  })

  it('ideaRepository를 주입하지 않으면 유효한 ADMIN 토큰의 PATCH /ideas/:id도 404여야 한다', async () => {
    const token = await signTestToken()

    await withServer(undefined, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

      expect(response.status).toBe(404)
    })
  })

  it('토큰이 없으면 401이고 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { body: { status: 'doing' } })

      expect(response.status).toBe(401)
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('ADMIN이 아닌 토큰이면 403이고 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken({ role: 'USER' })

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

      expect(response.status).toBe(403)
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('id가 uuid 형식이 아니면 404 IDEA_NOT_FOUND이고 본문이 잘못돼 있어도 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, id: 'idea-1', body: { status: 'archived' } })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ status: 'error', reason: 'IDEA_NOT_FOUND' })
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('본문이 없으면 400 INVALID_BODY이고 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('본문이 깨진 JSON이면 400 INVALID_BODY이고 응답에 본문 조각이 없으며 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: '{"title": "LEAK-FRAGMENT",' })
      const text = await response.text()

      expect(response.status).toBe(400)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(text).not.toContain('LEAK-FRAGMENT')
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('아는 필드가 하나도 없는 본문이면 400 INVALID_BODY이고 update는 호출되지 않아야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: {} })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason: 'INVALID_BODY' })
      expect(update).not.toHaveBeenCalled()
    })
  })

  it.each([
    { field: 'title', body: { title: '   ' }, reason: 'INVALID_TITLE' },
    { field: 'memo', body: { memo: 'a'.repeat(2001) }, reason: 'INVALID_MEMO' },
    { field: 'type', body: { type: 'OTHER' }, reason: 'INVALID_TYPE' },
    { field: 'status', body: { status: 'archived' }, reason: 'INVALID_STATUS' },
  ])('$field 필드가 잘못되면 400($reason)이고 update는 호출되지 않아야 한다', async ({ body, reason }) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository, update } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: 'error', reason })
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('저장소가 null을 돌려주면 404 IDEA_NOT_FOUND여야 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => null)
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

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
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

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
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })

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
      const response = await patchIdea(baseUrl, { token, body: { status: 'doing' } })
      const text = await response.text()

      expect(response.status).toBe(500)
      expect(JSON.parse(text)).toEqual({ status: 'error', reason: 'INTERNAL_ERROR' })
      expect(text).not.toContain('leaked-password')
      expect(text).not.toContain('postgresql://')
    })
  })

  it('어떤 실패든 console.error 로그에는 reason 코드만 있고 제목·메모·연결 문자열은 없어야 한다', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repository } = createFakeRepository(async () => {
      throw new Error('failed: postgresql://user:leaked-password@host.example/db')
    })
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      // 검증 실패: 제목·메모가 본문에 있어도 로그에 남지 않아야 한다
      await patchIdea(baseUrl, { token, body: { title: 'LEAK-TITLE', memo: 'LEAK-MEMO', type: 'OTHER' } })
      // 수정 실패: 원인 오류 메시지(연결 문자열)가 로그에 남지 않아야 한다
      await patchIdea(baseUrl, { token, body: { title: 'LEAK-TITLE', memo: 'LEAK-MEMO' } })
      // 없는 글감
      await patchIdea(baseUrl, { token, id: 'idea-1', body: { title: 'LEAK-TITLE' } })
    })

    const logged = errorLog.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('INVALID_TYPE')
    expect(logged).toContain('INTERNAL_ERROR')
    expect(logged).toContain('IDEA_NOT_FOUND')
    expect(logged).not.toContain('LEAK-TITLE')
    expect(logged).not.toContain('LEAK-MEMO')
    expect(logged).not.toContain('leaked-password')
    expect(logged).not.toMatch(/postgres(ql)?:\/\//)
  })

  it('PATCH를 추가해도 GET /ideas와 POST /ideas는 기존대로 동작해야 한다', async () => {
    const { repository, create, list } = createFakeRepository()
    const token = await signTestToken()

    await withServer(repository, async (baseUrl) => {
      const listResponse = await fetch(`${baseUrl}/ideas`, { headers: { Authorization: `Bearer ${token}` } })
      const createResponse = await fetch(`${baseUrl}/ideas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '제목', memo: '메모', type: 'LAB' }),
      })

      expect(listResponse.status).toBe(200)
      expect(createResponse.status).toBe(201)
      expect(list).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledTimes(1)
    })
  })
})
