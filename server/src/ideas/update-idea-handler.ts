import type { RequestHandler } from 'express'
import { isIdeaId } from './idea-id'
import { respondFailure, toRepositoryFailure } from './idea-failure'
import type { IdeaFailure } from './idea-failure'
import type { IdeaRepository } from './idea-types'
import { validateIdeaUpdate } from './validate-idea-update'

const NOT_FOUND: IdeaFailure = { statusCode: 404, body: { status: 'error', reason: 'IDEA_NOT_FOUND' } }

export function createUpdateIdeaHandler(repository: IdeaRepository): RequestHandler {
  return async (req, res) => {
    const { id } = req.params

    // 형식이 틀린 id는 본문을 보기 전에 없는 글감으로 답한다
    if (typeof id !== 'string' || !isIdeaId(id)) {
      respondFailure(res, NOT_FOUND)
      return
    }

    const validation = validateIdeaUpdate(req.body)

    if (!validation.ok) {
      respondFailure(res, { statusCode: 400, body: { status: 'error', reason: validation.reason } })
      return
    }

    try {
      const idea = await repository.update(id, validation.value)

      if (!idea) {
        respondFailure(res, NOT_FOUND)
        return
      }

      // 저장소가 돌려준 행의 나머지 필드(updatedAt 등)는 응답에 싣지 않는다
      const { title, memo, type, status, createdAt } = idea
      res.json({ id: idea.id, title, memo, type, status, createdAt: createdAt.toISOString() })
    } catch (error) {
      respondFailure(res, toRepositoryFailure(error))
    }
  }
}
