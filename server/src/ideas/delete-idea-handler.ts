import type { RequestHandler } from 'express'
import { respondFailure, toRepositoryFailure } from './idea-failure'
import type { IdeaFailure } from './idea-failure'
import { isIdeaId } from './idea-id'
import type { IdeaRepository } from './idea-types'

const NOT_FOUND: IdeaFailure = { statusCode: 404, body: { status: 'error', reason: 'IDEA_NOT_FOUND' } }

export function createDeleteIdeaHandler(repository: IdeaRepository): RequestHandler {
  return async (req, res) => {
    const { id } = req.params

    // 형식이 틀린 id는 DB에 묻지 않고 없는 글감으로 답한다
    if (typeof id !== 'string' || !isIdeaId(id)) {
      respondFailure(res, NOT_FOUND)
      return
    }

    try {
      const deleted = await repository.delete(id)

      if (!deleted) {
        respondFailure(res, NOT_FOUND)
        return
      }

      res.status(204).end()
    } catch (error) {
      respondFailure(res, toRepositoryFailure(error))
    }
  }
}
