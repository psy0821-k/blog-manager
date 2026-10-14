export const IDEA_STATUSES = ['todo', 'doing', 'done'] as const

export type IdeaStatus = (typeof IDEA_STATUSES)[number]

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  todo: '대기',
  doing: '진행',
  done: '완료',
}
