import { DatabaseUnreachableError } from '../db/prisma-client'
import type { Idea, IdeaRepository, NewIdea } from './idea-types'

// PrismaClient 중 글감 저장에 쓰는 부분만 좁힌 타입
export interface IdeaClient {
  idea: { create(args: { data: NewIdea }): Promise<Idea> }
}

// 연결 자체가 안 될 때 Prisma가 붙이는 코드
const CONNECTION_ERROR_CODES: readonly string[] = ['P1001', 'P1002', 'P1017']
const INITIALIZATION_ERROR_NAME = 'PrismaClientInitializationError'

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === INITIALIZATION_ERROR_NAME) return true

  return 'code' in error && typeof error.code === 'string' && CONNECTION_ERROR_CODES.includes(error.code)
}

// getClient는 저장할 때 부른다. DATABASE_URL이 없어도 서버가 뜨게 하려는 것이다
export function createPrismaIdeaRepository(getClient: () => IdeaClient): IdeaRepository {
  return {
    async create(idea) {
      const client = getClient()

      try {
        return await client.idea.create({ data: idea })
      } catch (error) {
        // 원인 오류의 메시지는 연결 문자열을 담을 수 있어 고정 문구의 오류로 바꾼다
        if (isConnectionError(error)) throw new DatabaseUnreachableError()
        throw error
      }
    },
  }
}
