import 'dotenv/config'
import { createApp } from './app'
import { readPort, readRequiredEnv } from './config/env'
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

createApp({ pingDatabase }).listen(port, () => {
  console.log(`서버가 ${port}번 포트에서 실행 중입니다.`)
})
