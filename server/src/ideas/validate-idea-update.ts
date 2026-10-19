import type { IdeaPatch } from './idea-types'
import { isIdeaStatus } from './validate-idea-list-query'
import { isIdeaType, MEMO_MAX_LENGTH, TITLE_MAX_LENGTH } from './validate-new-idea'

export type ValidateIdeaUpdateResult =
  | { ok: true; value: IdeaPatch }
  | { ok: false; reason: 'INVALID_BODY' | 'INVALID_TITLE' | 'INVALID_MEMO' | 'INVALID_TYPE' | 'INVALID_STATUS' }

const PATCH_FIELDS = ['title', 'memo', 'type', 'status'] as const

// 본문에 있는 title·memo·type·status만 POST와 같은 규칙으로 검사하고 첫 실패만 알린다.
// 아는 필드가 하나도 없으면 INVALID_BODY이고, 그 밖의 필드(id, createdAt 등)는 무시한다
export function validateIdeaUpdate(body: unknown): ValidateIdeaUpdateResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'INVALID_BODY' }
  }

  if (!PATCH_FIELDS.some((field) => Object.hasOwn(body, field))) {
    return { ok: false, reason: 'INVALID_BODY' }
  }

  const { title, memo, type, status } = body as Record<string, unknown>
  const patch: IdeaPatch = {}

  if (Object.hasOwn(body, 'title')) {
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    if (trimmedTitle.length === 0 || trimmedTitle.length > TITLE_MAX_LENGTH) {
      return { ok: false, reason: 'INVALID_TITLE' }
    }
    patch.title = trimmedTitle
  }

  if (Object.hasOwn(body, 'memo')) {
    if (typeof memo !== 'string' || memo.length > MEMO_MAX_LENGTH) return { ok: false, reason: 'INVALID_MEMO' }
    patch.memo = memo
  }

  if (Object.hasOwn(body, 'type')) {
    if (!isIdeaType(type)) return { ok: false, reason: 'INVALID_TYPE' }
    patch.type = type
  }

  if (Object.hasOwn(body, 'status')) {
    if (!isIdeaStatus(status)) return { ok: false, reason: 'INVALID_STATUS' }
    patch.status = status
  }

  return { ok: true, value: patch }
}
