import type { Response } from 'express'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { IdeaFailureBody } from './idea-types'

export interface IdeaFailure {
  statusCode: 400 | 404 | 500 | 503
  body: IdeaFailureBody
}

// 저장소 실패 원인을 reason 코드로만 알린다. 원인 오류의 메시지는 연결 문자열을 담을 수 있어 쓰지 않는다
export function toRepositoryFailure(error: unknown): IdeaFailure {
  if (error instanceof MissingEnvError) {
    return { statusCode: 503, body: { status: 'error', reason: 'DATABASE_URL_MISSING' } }
  }
  if (error instanceof DatabaseUnreachableError) {
    return { statusCode: 503, body: { status: 'error', reason: 'DATABASE_UNREACHABLE' } }
  }

  return { statusCode: 500, body: { status: 'error', reason: 'INTERNAL_ERROR' } }
}

export function respondFailure(res: Response, { statusCode, body }: IdeaFailure): void {
  // 로그에도 reason 코드만 남긴다(제목·메모는 남기지 않는다)
  console.error(`[ideas] ${body.reason}`)
  res.status(statusCode).json(body)
}
