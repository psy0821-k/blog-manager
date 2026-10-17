import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

export type PingDatabase = () => Promise<void>

export class DatabaseUnreachableError extends Error {
  constructor() {
    // 원인 오류의 메시지에 연결 문자열이 섞일 수 있어 고정 문구만 쓴다
    super('데이터베이스에 연결할 수 없습니다.')
    this.name = 'DatabaseUnreachableError'
  }
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  return new PrismaClient({ adapter })
}

export function createPingDatabase(client: Pick<PrismaClient, '$queryRaw'>): PingDatabase {
  return async () => {
    try {
      await client.$queryRaw`SELECT 1`
    } catch {
      throw new DatabaseUnreachableError()
    }
  }
}
