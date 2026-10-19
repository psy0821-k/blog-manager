import express from 'express'
import type { Express } from 'express'
import type { PingDatabase } from './db/prisma-client'
import { createAuthNotConfigured } from './auth/auth-not-configured'
import { createRequireAuth } from './auth/require-auth'
import { createVerifyAdminToken } from './auth/verify-admin-token'
import { createCors } from './cors/create-cors'
import { checkHealth } from './health/check-health'
import { handleBodyError, parseJsonBody } from './http/json-body'
import { createIdeaHandler } from './ideas/create-idea-handler'
import { createListIdeasHandler } from './ideas/list-ideas-handler'
import type { IdeaRepository } from './ideas/idea-types'

export interface AppDependencies {
  pingDatabase: PingDatabase
  // 없거나 공백뿐이면 인증 미설정으로 취급한다
  authSecret?: string
  adminAppOrigin?: string
  // 있을 때만 /ideas 라우트를 등록한다
  ideaRepository?: IdeaRepository
}

export function createApp({ pingDatabase, authSecret, adminAppOrigin, ideaRepository }: AppDependencies): Express {
  const app = express()

  app.use(createCors(adminAppOrigin))
  const authConfigured = Boolean(authSecret?.trim())
  // authSecret을 그대로 넘겨 기존 동작을 유지하고, 타입 단언 없이 string으로 좁힌다
  app.use(authConfigured && authSecret ? createRequireAuth(createVerifyAdminToken(authSecret)) : createAuthNotConfigured())

  app.get('/health', async (_req, res) => {
    const { statusCode, body } = await checkHealth(pingDatabase, authConfigured)

    // 로그에도 reason 코드만 남긴다
    if (body.status === 'error') console.error(`[health] ${body.reason}`)

    res.status(statusCode).json(body)
  })

  app.get('/auth/check', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // 본문은 인증을 통과한 요청만 읽는다
  app.use(parseJsonBody)
  if (ideaRepository) {
    app.get('/ideas', createListIdeasHandler(ideaRepository))
    app.post('/ideas', createIdeaHandler(ideaRepository))
  }

  app.use(handleBodyError)

  return app
}
