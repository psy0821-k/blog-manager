import type { RequestHandler, Response } from 'express'
import { MissingEnvError } from '../config/env'
import { DatabaseUnreachableError } from '../db/prisma-client'
import type { IdeaFailureBody, IdeaRepository } from './idea-types'
import { validateNewIdea } from './validate-new-idea'

interface IdeaFailure {
  statusCode: 400 | 500 | 503
  body: IdeaFailureBody
}

// 저장 실패 원인을 reason 코드로만 알린다. 원인 오류의 메시지는 연결 문자열을 담을 수 있어 쓰지 않는다
function toSaveFailure(error: unknown): IdeaFailure {
  if (error instanceof MissingEnvError) {
    return { statusCode: 503, body: { status: 'error', reason: 'DATABASE_URL_MISSING' } }
  }
  if (error instanceof DatabaseUnreachableError) {
    return { statusCode: 503, body: { status: 'error', reason: 'DATABASE_UNREACHABLE' } }
  }

  return { statusCode: 500, body: { status: 'error', reason: 'INTERNAL_ERROR' } }
}

function respondFailure(res: Response, { statusCode, body }: IdeaFailure): void {
  // 로그에도 reason 코드만 남긴다(제목·메모는 남기지 않는다)
  console.error(`[ideas] ${body.reason}`)
  res.status(statusCode).json(body)
}

export function createIdeaHandler(repository: IdeaRepository): RequestHandler {
  return async (req, res) => {
    const validation = validateNewIdea(req.body)

    if (!validation.ok) {
      respondFailure(res, { statusCode: 400, body: { status: 'error', reason: validation.reason } })
      return
    }

    try {
      const { id, title, memo, type, status, createdAt } = await repository.create(validation.value)

      // 저장소가 돌려준 행의 나머지 필드(updatedAt 등)는 응답에 싣지 않는다
      res.status(201).json({ id, title, memo, type, status, createdAt: createdAt.toISOString() })
    } catch (error) {
      respondFailure(res, toSaveFailure(error))
    }
  }
}
