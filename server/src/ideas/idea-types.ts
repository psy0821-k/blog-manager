export const IDEA_TYPES = ['PROJECT', 'LAB', 'DEV_LOG'] as const
export type IdeaType = (typeof IDEA_TYPES)[number]
export type IdeaStatus = 'todo' | 'doing' | 'done'

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

export interface IdeaRepository {
  create(idea: NewIdea): Promise<Idea>
}

export type IdeaFailureReason =
  | 'INVALID_BODY'
  | 'INVALID_TITLE'
  | 'INVALID_MEMO'
  | 'INVALID_TYPE'
  | 'DATABASE_URL_MISSING'
  | 'DATABASE_UNREACHABLE'
  | 'INTERNAL_ERROR'

export interface IdeaFailureBody {
  status: 'error'
  reason: IdeaFailureReason
}
