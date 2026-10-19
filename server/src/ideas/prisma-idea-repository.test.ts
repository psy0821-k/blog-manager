import { describe, expect, it, vi } from 'vitest'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, NewIdea } from './idea-types'
import { createPrismaIdeaRepository } from './prisma-idea-repository'
import type { IdeaClient } from './prisma-idea-repository'

const newIdea: NewIdea = { title: '제목', memo: '메모', type: 'DEV_LOG' }

const savedIdea: Idea = {
  id: 'idea-1',
  ...newIdea,
  status: 'todo',
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
}

/** idea.create만 흉내 내는 클라이언트. 실제 DB에는 연결하지 않는다. */
function createClientStub(create: IdeaClient['idea']['create']) {
  const fake = vi.fn(create)

  return { client: { idea: { create: fake, findMany: async () => [] } } satisfies IdeaClient, create: fake }
}

/** idea.findMany만 흉내 내는 클라이언트. 실제 DB에는 연결하지 않는다. */
function createListClientStub(findMany: IdeaClient['idea']['findMany']) {
  const fake = vi.fn(findMany)

  return {
    client: {
      idea: {
        create: async () => {
          throw new Error('list는 create를 부르지 않는다')
        },
        findMany: fake,
      },
    } satisfies IdeaClient,
    findMany: fake,
  }
}

/** Prisma 오류처럼 code 속성을 가진 오류 */
function createPrismaLikeError(code: string): Error {
  return Object.assign(new Error(`prisma error ${code}`), { code })
}

describe('createPrismaIdeaRepository', () => {
  it('create를 부르면 클라이언트의 idea.create가 { data: { title, memo, type } }로 호출되고 반환된 글감을 그대로 돌려줘야 한다', async () => {
    const { client, create } = createClientStub(async () => savedIdea)
    const repository = createPrismaIdeaRepository(() => client)

    const result = await repository.create(newIdea)

    expect(create).toHaveBeenCalledWith({ data: { title: '제목', memo: '메모', type: 'DEV_LOG' } })
    expect(result).toEqual(savedIdea)
  })

  it('저장소를 만들 때는 getClient를 호출하지 않고 create를 부를 때 호출해야 한다', async () => {
    const { client } = createClientStub(async () => savedIdea)
    const getClient = vi.fn(() => client)

    const repository = createPrismaIdeaRepository(getClient)
    expect(getClient).not.toHaveBeenCalled()

    await repository.create(newIdea)
    expect(getClient).toHaveBeenCalledTimes(1)
  })

  it('getClient가 MissingEnvError를 던지면 그대로 전파하고 idea.create는 호출하지 않아야 한다', async () => {
    const missing = new MissingEnvError('DATABASE_URL')
    const { client, create } = createClientStub(async () => savedIdea)
    const repository = createPrismaIdeaRepository(() => {
      void client
      throw missing
    })

    await expect(repository.create(newIdea)).rejects.toBe(missing)
    expect(create).not.toHaveBeenCalled()
  })

  it.each(['P1001', 'P1002', 'P1017'])(
    'idea.create가 %s 코드의 오류를 던지면 DatabaseUnreachableError로 바꿔 던져야 한다',
    async (code) => {
      const { client } = createClientStub(async () => {
        throw createPrismaLikeError(code)
      })
      const repository = createPrismaIdeaRepository(() => client)

      await expect(repository.create(newIdea)).rejects.toBeInstanceOf(DatabaseUnreachableError)
    },
  )

  it('idea.create가 PrismaClientInitializationError 이름의 오류를 던지면 DatabaseUnreachableError로 바꿔 던져야 한다', async () => {
    const { client } = createClientStub(async () => {
      throw Object.assign(new Error('initialization failed'), { name: 'PrismaClientInitializationError' })
    })
    const repository = createPrismaIdeaRepository(() => client)

    await expect(repository.create(newIdea)).rejects.toBeInstanceOf(DatabaseUnreachableError)
  })

  it('idea.create가 그 밖의 오류(예: P2002)를 던지면 원래 오류를 그대로 전파해야 한다', async () => {
    const original = createPrismaLikeError('P2002')
    const { client } = createClientStub(async () => {
      throw original
    })
    const repository = createPrismaIdeaRepository(() => client)

    await expect(repository.create(newIdea)).rejects.toBe(original)
  })

  it('변환된 DatabaseUnreachableError의 메시지에는 원인 오류 메시지(연결 문자열 포함)가 없어야 한다', async () => {
    const { client } = createClientStub(async () => {
      throw Object.assign(new Error('connect failed: postgresql://user:leaked-password@host.example/db'), {
        code: 'P1001',
      })
    })
    const repository = createPrismaIdeaRepository(() => client)

    const error = await repository.create(newIdea).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(DatabaseUnreachableError)
    expect((error as Error).message).not.toContain('leaked-password')
    expect((error as Error).message).not.toContain('postgresql://')
  })
})

describe('createPrismaIdeaRepository.list', () => {
  it('필터가 없으면 where 없이 updatedAt 내림차순, 최대 200건으로 조회해야 한다', async () => {
    const { client, findMany } = createListClientStub(async () => [savedIdea])
    const repository = createPrismaIdeaRepository(() => client)

    await repository.list({})

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({ where: undefined, orderBy: { updatedAt: 'desc' }, take: 200 })
  })

  it('status 필터가 있으면 where에 그 status를 넘겨야 한다', async () => {
    const { client, findMany } = createListClientStub(async () => [])
    const repository = createPrismaIdeaRepository(() => client)

    await repository.list({ status: 'doing' })

    expect(findMany).toHaveBeenCalledWith({ where: { status: 'doing' }, orderBy: { updatedAt: 'desc' }, take: 200 })
  })

  it('클라이언트가 돌려준 행을 그대로 돌려줘야 한다', async () => {
    const other: Idea = { ...savedIdea, id: 'idea-2' }
    const { client } = createListClientStub(async () => [savedIdea, other])
    const repository = createPrismaIdeaRepository(() => client)

    await expect(repository.list({})).resolves.toEqual([savedIdea, other])
  })

  it('결과가 없으면 빈 배열을 돌려줘야 한다', async () => {
    const { client } = createListClientStub(async () => [])
    const repository = createPrismaIdeaRepository(() => client)

    await expect(repository.list({})).resolves.toEqual([])
  })

  it('저장소를 만들 때는 getClient를 호출하지 않고 list를 부를 때 호출해야 한다', async () => {
    const { client } = createListClientStub(async () => [])
    const getClient = vi.fn(() => client)

    const repository = createPrismaIdeaRepository(getClient)
    expect(getClient).not.toHaveBeenCalled()

    await repository.list({})
    expect(getClient).toHaveBeenCalledTimes(1)
  })

  it('getClient가 MissingEnvError를 던지면 그대로 전파하고 findMany는 호출하지 않아야 한다', async () => {
    const missing = new MissingEnvError('DATABASE_URL')
    const { client, findMany } = createListClientStub(async () => [])
    const repository = createPrismaIdeaRepository(() => {
      void client
      throw missing
    })

    await expect(repository.list({})).rejects.toBe(missing)
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each(['P1001', 'P1002', 'P1017'])(
    'findMany가 %s 코드의 오류를 던지면 DatabaseUnreachableError로 바꿔 던져야 한다',
    async (code) => {
      const { client } = createListClientStub(async () => {
        throw createPrismaLikeError(code)
      })
      const repository = createPrismaIdeaRepository(() => client)

      await expect(repository.list({})).rejects.toBeInstanceOf(DatabaseUnreachableError)
    },
  )

  it('findMany가 연결 오류가 아닌 오류를 던지면 원래 오류를 그대로 전파해야 한다', async () => {
    const original = createPrismaLikeError('P2002')
    const { client } = createListClientStub(async () => {
      throw original
    })
    const repository = createPrismaIdeaRepository(() => client)

    await expect(repository.list({})).rejects.toBe(original)
  })

  it('변환된 DatabaseUnreachableError의 메시지에는 원인 오류 메시지(연결 문자열 포함)가 없어야 한다', async () => {
    const { client } = createListClientStub(async () => {
      throw Object.assign(new Error('connect failed: postgresql://user:leaked-password@host.example/db'), {
        code: 'P1001',
      })
    })
    const repository = createPrismaIdeaRepository(() => client)

    const error = await repository.list({}).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(DatabaseUnreachableError)
    expect((error as Error).message).not.toContain('leaked-password')
    expect((error as Error).message).not.toContain('postgresql://')
  })
})
