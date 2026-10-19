import { IDEA_TYPES } from './idea-types'
import type { IdeaType, NewIdea } from './idea-types'

export const TITLE_MAX_LENGTH = 100
export const MEMO_MAX_LENGTH = 2000

export type ValidateNewIdeaResult =
  | { ok: true; value: NewIdea }
  | { ok: false; reason: 'INVALID_BODY' | 'INVALID_TITLE' | 'INVALID_MEMO' | 'INVALID_TYPE' }

function isIdeaType(value: unknown): value is IdeaType {
  return IDEA_TYPES.some((type) => type === value)
}

// 본문 → title → memo → type 순서로 검사하고 첫 실패만 알린다. status는 읽지 않는다
export function validateNewIdea(body: unknown): ValidateNewIdeaResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'INVALID_BODY' }
  }

  // memo를 생략하면 빈 문자열로 본다(null은 생략이 아니라 잘못된 값)
  const { title, memo = '', type } = body as Record<string, unknown>

  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  if (trimmedTitle.length === 0 || trimmedTitle.length > TITLE_MAX_LENGTH) {
    return { ok: false, reason: 'INVALID_TITLE' }
  }

  if (typeof memo !== 'string' || memo.length > MEMO_MAX_LENGTH) {
    return { ok: false, reason: 'INVALID_MEMO' }
  }

  if (!isIdeaType(type)) return { ok: false, reason: 'INVALID_TYPE' }

  return { ok: true, value: { title: trimmedTitle, memo, type } }
}
