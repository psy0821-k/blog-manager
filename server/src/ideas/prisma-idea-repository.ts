import { DatabaseUnreachableError } from '../db/prisma-client'
import { IDEA_LIST_LIMIT } from './idea-types'
import type { Idea, IdeaPatch, IdeaRepository, IdeaStatus, NewIdea } from './idea-types'

// PrismaClient 중 글감 저장에 쓰는 부분만 좁힌 타입
export interface IdeaClient {
  idea: {
    create(args: { data: NewIdea }): Promise<Idea>
    findMany(args: {
      where: { status: IdeaStatus } | undefined
      orderBy: { updatedAt: 'desc' }
      take: number
    }): Promise<Idea[]>
    update(args: { where: { id: string }; data: IdeaPatch }): Promise<Idea>
    delete(args: { where: { id: string } }): Promise<Idea>
  }
}

// 연결 자체가 안 될 때 Prisma가 붙이는 코드
const CONNECTION_ERROR_CODES: readonly string[] = ['P1001', 'P1002', 'P1017']
const INITIALIZATION_ERROR_NAME = 'PrismaClientInitializationError'
// 수정·삭제할 행이 없을 때 Prisma가 붙이는 코드
const RECORD_NOT_FOUND_CODE = 'P2025'

function hasErrorCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' && codes.includes(error.code)
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === INITIALIZATION_ERROR_NAME) return true

  return hasErrorCode(error, CONNECTION_ERROR_CODES)
}

// 연결 오류는 고정 문구의 오류로 바꾼다. 원인 오류의 메시지는 연결 문자열을 담을 수 있다
async function withConnectionErrorMapped<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isConnectionError(error)) throw new DatabaseUnreachableError()
    throw error
  }
}

// getClient는 요청을 처리할 때 부른다. DATABASE_URL이 없어도 서버가 뜨게 하려는 것이다
export function createPrismaIdeaRepository(getClient: () => IdeaClient): IdeaRepository {
  return {
    async create(idea) {
      const client = getClient()

      return withConnectionErrorMapped(() => client.idea.create({ data: idea }))
    },

    async list({ status }) {
      const client = getClient()

      return withConnectionErrorMapped(() =>
        client.idea.findMany({
          where: status ? { status } : undefined,
          orderBy: { updatedAt: 'desc' },
          take: IDEA_LIST_LIMIT,
        }),
      )
    },

    async update(id, patch) {
      const client = getClient()

      return withConnectionErrorMapped(async () => {
        try {
          return await client.idea.update({ where: { id }, data: patch })
        } catch (error) {
          if (hasErrorCode(error, [RECORD_NOT_FOUND_CODE])) return null
          throw error
        }
      })
    },

    async delete(id) {
      const client = getClient()

      return withConnectionErrorMapped(async () => {
        try {
          await client.idea.delete({ where: { id } })
          return true
        } catch (error) {
          if (hasErrorCode(error, [RECORD_NOT_FOUND_CODE])) return false
          throw error
        }
      })
    },
  }
}
