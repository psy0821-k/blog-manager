import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '../../generated/prisma/client'
import { createPingDatabase, createPrismaClient, DatabaseUnreachableError } from './prisma-client'

type QueryClient = Pick<PrismaClient, '$queryRaw'>

/** $queryRaw만 흉내 내는 클라이언트. 실제 DB에는 연결하지 않는다. */
function createClientStub(query: () => Promise<unknown>): QueryClient {
  return { $queryRaw: vi.fn(query) } as unknown as QueryClient
}

describe('createPrismaClient', () => {
  it('연결 문자열을 받을 때 DB에 연결하지 않고 PrismaClient 인스턴스를 만들어야 한다', () => {
    const client = createPrismaClient('postgresql://user:password@localhost:5432/example')

    expect(typeof client.$queryRaw).toBe('function')
  })
})

describe('createPingDatabase', () => {
  it('$queryRaw가 성공할 때 resolve해야 한다', async () => {
    const ping = createPingDatabase(createClientStub(async () => [{ result: 1 }]))

    await expect(ping()).resolves.toBeUndefined()
  })

  it('$queryRaw가 거부될 때 DatabaseUnreachableError로 거부해야 한다', async () => {
    const ping = createPingDatabase(
      createClientStub(async () => {
        throw new Error('connection refused')
      }),
    )

    await expect(ping()).rejects.toBeInstanceOf(DatabaseUnreachableError)
  })

  it('원인 오류 메시지에 연결 문자열이 있어도 DatabaseUnreachableError 메시지에는 그 내용이 없어야 한다', async () => {
    const ping = createPingDatabase(
      createClientStub(async () => {
        throw new Error('connect failed: postgresql://user:leaked-password@host.example/db')
      }),
    )

    const error = await ping().catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(DatabaseUnreachableError)
    expect((error as Error).message).not.toContain('leaked-password')
    expect((error as Error).message).not.toContain('postgresql://')
  })
})
