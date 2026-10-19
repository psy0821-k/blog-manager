import type { RequestHandler } from 'express'
import { isPublicRoute } from './public-routes'

// 인증 설정이 없을 때 공개 경로 외 모든 요청을 503으로 막는다
export function createAuthNotConfigured(): RequestHandler {
  return (req, res, next) => {
    if (isPublicRoute(req.method, req.path)) {
      next()
      return
    }

    // 로그에는 코드만 남긴다
    console.error('[auth] AUTH_NOT_CONFIGURED')
    res.status(503).json({ status: 'error', reason: 'AUTH_NOT_CONFIGURED' })
  }
}
