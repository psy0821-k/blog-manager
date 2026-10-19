import 'dotenv/config'
import { createApp } from './app'
import { readAuthSecret } from './auth/read-auth-secret'
import { readOptionalEnv, readPort, readRequiredEnv } from './config/env'
import { createPingDatabase, createPrismaClient } from './db/prisma-client'
import type { PingDatabase } from './db/prisma-client'
import { createPrismaIdeaRepository } from './ideas/prisma-idea-repository'
import type { PrismaClient } from '../generated/prisma/client'

let cachedClient: PrismaClient | undefined

// 헬스체크와 글감 저장이 같은 클라이언트(커넥션 풀)를 쓴다. DATABASE_URL이 없으면 쓰는 시점에 MissingEnvError가 난다
function getPrismaClient(): PrismaClient {
  if (!cachedClient) {
    cachedClient = createPrismaClient(readRequiredEnv(process.env, 'DATABASE_URL'))
  }

  return cachedClient
}

let cachedPing: PingDatabase | undefined

// DATABASE_URL이 없어도 서버는 뜨고, 헬스체크가 DATABASE_URL_MISSING으로 알린다
const pingDatabase: PingDatabase = async () => {
  if (!cachedPing) {
    cachedPing = createPingDatabase(getPrismaClient())
  }

  return cachedPing()
}

const port = readPort(process.env)

createApp({
  pingDatabase,
  authSecret: readAuthSecret(process.env),
  // 누락돼도 기동은 하고, CORS 허용 오리진만 없는 상태가 된다
  adminAppOrigin: readOptionalEnv(process.env, 'ADMIN_APP_ORIGIN'),
  ideaRepository: createPrismaIdeaRepository(getPrismaClient),
}).listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행 중입니다.`)
})
