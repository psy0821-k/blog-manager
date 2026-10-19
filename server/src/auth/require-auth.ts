import type { RequestHandler } from 'express'
import type { AuthFailure } from './auth-types'
import { extractBearerToken } from './extract-bearer-token'
import { isPublicRoute } from './public-routes'
import type { VerifyAdminToken } from './verify-admin-token'

const TOKEN_MISSING: AuthFailure = { statusCode: 401, body: { status: 'error', reason: 'TOKEN_MISSING' } }

// 공개 경로면 통과, 아니면 Bearer 토큰을 검증한다
export function createRequireAuth(verify: VerifyAdminToken): RequestHandler {
  return async (req, res, next) => {
    if (isPublicRoute(req.method, req.path)) {
      next()
      return
    }

    const token = extractBearerToken(req.headers.authorization)
    const failure = token === null ? TOKEN_MISSING : await verify(token)

    if (failure === null) {
      next()
      return
    }

    // 로그에도 reason 코드만 남긴다
    console.error(`[auth] ${failure.body.reason}`)

    if (failure.statusCode === 401) res.set('WWW-Authenticate', 'Bearer')
    res.status(failure.statusCode).json(failure.body)
  }
}
