import 'dotenv/config'
import { createApp } from './app'
import { readAuthSecret } from './auth/read-auth-secret'
import { readOptionalEnv, readPort, readRequiredEnv } from './config/env'
import { createPingDatabase, createPrismaClient } from './db/prisma-client'
import type { PingDatabase } from './db/prisma-client'

let cachedPing: PingDatabase | undefined

// DATABASE_URL이 없어도 서버는 뜨고, 헬스체크가 DATABASE_URL_MISSING으로 알린다
const pingDatabase: PingDatabase = async () => {
  if (!cachedPing) {
    const databaseUrl = readRequiredEnv(process.env, 'DATABASE_URL')
    cachedPing = createPingDatabase(createPrismaClient(databaseUrl))
  }

  return cachedPing()
}

const port = readPort(process.env)

createApp({
  pingDatabase,
  authSecret: readAuthSecret(process.env),
  // 누락돼도 기동은 하고, CORS 허용 오리진만 없는 상태가 된다
  adminAppOrigin: readOptionalEnv(process.env, 'ADMIN_APP_ORIGIN'),
}).listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행 중입니다.`)
})
