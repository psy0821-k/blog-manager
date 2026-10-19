import express from 'express'
import type { ErrorRequestHandler, RequestHandler } from 'express'

export const JSON_BODY_LIMIT = '16kb'

export const parseJsonBody: RequestHandler = express.json({ limit: JSON_BODY_LIMIT })

type BodyFailureReason = 'INVALID_BODY' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL_ERROR'

interface BodyFailureBody {
  status: 'error'
  reason: BodyFailureReason
}

type BodyFailure = { statusCode: 400 | 413 | 500; body: BodyFailureBody }

// body-parser 오류는 type으로 구분한다. 원인 오류의 메시지는 응답에 쓰지 않는다
function toBodyFailure(error: unknown): BodyFailure {
  const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined

  if (type === 'entity.parse.failed') return { statusCode: 400, body: { status: 'error', reason: 'INVALID_BODY' } }
  if (type === 'entity.too.large') return { statusCode: 413, body: { status: 'error', reason: 'PAYLOAD_TOO_LARGE' } }

  return { statusCode: 500, body: { status: 'error', reason: 'INTERNAL_ERROR' } }
}

// 4개 인자를 모두 선언해야 Express가 오류 처리기로 인식한다
export const handleBodyError: ErrorRequestHandler = (error, _req, res, _next) => {
  const { statusCode, body } = toBodyFailure(error)

  // 로그에도 reason 코드만 남긴다
  console.error(`[http] ${body.reason}`)
  res.status(statusCode).json(body)
}
