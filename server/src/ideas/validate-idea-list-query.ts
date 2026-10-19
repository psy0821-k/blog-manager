import { IDEA_STATUSES } from './idea-types'
import type { IdeaListFilter, IdeaStatus } from './idea-types'

export type ValidateIdeaListQueryResult =
  | { ok: true; value: IdeaListFilter }
  | { ok: false; reason: 'INVALID_STATUS' }

function isIdeaStatus(value: unknown): value is IdeaStatus {
  return IDEA_STATUSES.some((status) => status === value)
}

// status를 생략하면 전체 조회다. 빈 문자열과 배열(?status=a&status=b)은 생략이 아니라 잘못된 값으로 본다
export function validateIdeaListQuery(query: unknown): ValidateIdeaListQueryResult {
  const { status } = (query ?? {}) as Record<string, unknown>

  if (status === undefined) return { ok: true, value: {} }
  if (!isIdeaStatus(status)) return { ok: false, reason: 'INVALID_STATUS' }

  return { ok: true, value: { status } }
}
