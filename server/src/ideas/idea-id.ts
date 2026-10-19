const IDEA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 글감 id는 uuid다. 형식이 틀리면 DB에 물어볼 필요 없이 없는 글감으로 본다
export function isIdeaId(value: string): boolean {
  return IDEA_ID_PATTERN.test(value)
}
