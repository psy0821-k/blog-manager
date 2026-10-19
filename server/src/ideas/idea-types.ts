export const IDEA_TYPES = ['PROJECT', 'LAB', 'DEV_LOG'] as const
export type IdeaType = (typeof IDEA_TYPES)[number]
export const IDEA_STATUSES = ['todo', 'doing', 'done'] as const
export type IdeaStatus = (typeof IDEA_STATUSES)[number]

// 목록 한 번에 돌려주는 최대 건수
export const IDEA_LIST_LIMIT = 200

// 검증을 통과한 값. status는 저장소(DB 기본값)가 정한다
export interface NewIdea {
  title: string
  memo: string
  type: IdeaType
}

export interface Idea extends NewIdea {
  id: string
  status: IdeaStatus
  createdAt: Date
}

export interface IdeaListFilter {
  status?: IdeaStatus
}

export interface IdeaRepository {
  create(idea: NewIdea): Promise<Idea>
  // updatedAt 내림차순, 최대 IDEA_LIST_LIMIT건
  list(filter: IdeaListFilter): Promise<Idea[]>
}

export type IdeaFailureReason =
  | 'INVALID_BODY'
  | 'INVALID_TITLE'
  | 'INVALID_MEMO'
  | 'INVALID_TYPE'
  | 'INVALID_STATUS'
  | 'DATABASE_URL_MISSING'
  | 'DATABASE_UNREACHABLE'
  | 'INTERNAL_ERROR'

export interface IdeaFailureBody {
  status: 'error'
  reason: IdeaFailureReason
}
