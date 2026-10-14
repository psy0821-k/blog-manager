export const POST_TYPES = ['PROJECT', 'LAB', 'DEV_LOG'] as const

export type PostType = (typeof POST_TYPES)[number]

export type PostStatus = 'IN_PROGRESS' | 'COMPLETED' | 'UP_COMING'

export const POST_TYPE_LABELS: Record<PostType, string> = {
  PROJECT: '프로젝트',
  LAB: '랩',
  DEV_LOG: '개발일지',
}

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  UP_COMING: '예정',
}

/** 목록 API 항목. status와 devNumber는 종류에 따라 응답에 없을 수 있다. */
export interface PostListItem {
  id: string
  title: string
  slug: string
  viewCount: number
  createdAt: string
  updatedAt: string
  status?: PostStatus
  devNumber?: number | null
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface PostListResponse {
  data: PostListItem[]
  meta: PaginationMeta
}

export function isPostType(value: string | null): value is PostType {
  return POST_TYPES.some((type) => type === value)
}
