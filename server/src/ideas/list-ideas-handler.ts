import type { RequestHandler } from 'express'
import { respondFailure, toRepositoryFailure } from './idea-failure'
import type { IdeaRepository } from './idea-types'
import { validateIdeaListQuery } from './validate-idea-list-query'

export function createListIdeasHandler(repository: IdeaRepository): RequestHandler {
  return async (req, res) => {
    const validation = validateIdeaListQuery(req.query)

    if (!validation.ok) {
      respondFailure(res, { statusCode: 400, body: { status: 'error', reason: validation.reason } })
      return
    }

    try {
      const ideas = await repository.list(validation.value)

      // 저장소가 돌려준 행의 나머지 필드(updatedAt 등)는 응답에 싣지 않는다
      res.json({
        data: ideas.map(({ id, title, memo, type, status, createdAt }) => ({
          id,
          title,
          memo,
          type,
          status,
          createdAt: createdAt.toISOString(),
        })),
      })
    } catch (error) {
      respondFailure(res, toRepositoryFailure(error))
    }
  }
}
