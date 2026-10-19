export const IDEA_STATUSES = ['todo', 'doing', 'done'] as const

export type IdeaStatus = (typeof IDEA_STATUSES)[number]

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  todo: '대기',
  doing: '진행',
  done: '완료',
}

// 서버(server/src/ideas/validate-new-idea.ts)의 한도와 같은 값
export const IDEA_TITLE_MAX_LENGTH = 100
export const IDEA_MEMO_MAX_LENGTH = 2000
