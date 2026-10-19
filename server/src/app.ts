import express from 'express'
import type { Express } from 'express'
import type { PingDatabase } from './db/prisma-client'
import { createRequireAuth } from './auth/require-auth'
import { createVerifyAdminToken } from './auth/verify-admin-token'
import { checkHealth } from './health/check-health'

export interface AppDependencies {
  pingDatabase: PingDatabase
  authSecret: string
}

export function createApp({ pingDatabase, authSecret }: AppDependencies): Express {
  const app = express()

  app.use(createRequireAuth(createVerifyAdminToken(authSecret)))

  app.get('/health', async (_req, res) => {
    const { statusCode, body } = await checkHealth(pingDatabase)

    // 로그에도 reason 코드만 남긴다
    if (body.status === 'error') console.error(`[health] ${body.reason}`)

    res.status(statusCode).json(body)
  })

  app.get('/auth/check', (_req, res) => {
    res.json({ status: 'ok' })
  })

  return app
}
