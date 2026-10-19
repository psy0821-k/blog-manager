import type { RequestHandler } from 'express'

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Authorization, Content-Type'

/** 허용 오리진과 정확히 일치하는 요청에만 CORS 헤더를 붙인다. 미설정이면 아무것도 하지 않는다. */
export function createCors(allowedOrigin?: string): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin

    if (!allowedOrigin || !origin || origin !== allowedOrigin) {
      next()
      return
    }

    res.setHeader('Access-Control-Allow-Origin', origin)
    res.vary('Origin')

    // 사전 요청은 인증 전에 여기서 끝낸다
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS)
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS)
      res.status(204).end()
      return
    }

    next()
  }
}
