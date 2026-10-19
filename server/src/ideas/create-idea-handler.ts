import type { RequestHandler } from 'express'
import { respondFailure, toRepositoryFailure } from './idea-failure'
import type { IdeaRepository } from './idea-types'
import { validateNewIdea } from './validate-new-idea'

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
      respondFailure(res, toRepositoryFailure(error))
    }
  }
}
