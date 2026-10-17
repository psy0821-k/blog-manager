import express from 'express'
import type { Express } from 'express'
import type { PingDatabase } from './db/prisma-client'
import { checkHealth } from './health/check-health'

export interface AppDependencies {
  pingDatabase: PingDatabase
}

export function createApp({ pingDatabase }: AppDependencies): Express {
  const app = express()

  app.get('/health', async (_req, res) => {
    const { statusCode, body } = await checkHealth(pingDatabase)

    // 로그에도 reason 코드만 남긴다
    if (body.status === 'error') console.error(`[health] ${body.reason}`)

    res.status(statusCode).json(body)
  })

  return app
}
