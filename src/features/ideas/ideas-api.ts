import { apiGet, apiPatch, apiPost } from '../../lib/api-client'
import { SERVER_API_URL } from '../../lib/env'
import type { PostType } from '../posts/post-types'
import type { IdeaStatus } from './idea-types'

export interface NewIdeaInput {
  title: string
  memo: string
  type: PostType
}

export interface SavedIdea extends NewIdeaInput {
  id: string
  status: IdeaStatus
  createdAt: string
}

/** 글감 한 건을 자체 서버에 저장한다. status는 서버가 todo로 정하므로 보내지 않는다. */
export function createIdea({ title, memo, type }: NewIdeaInput, signal?: AbortSignal): Promise<SavedIdea> {
  return apiPost<SavedIdea>('/ideas', { title, memo, type }, { baseUrl: SERVER_API_URL, signal })
}

export interface IdeaListResponse {
  data: SavedIdea[]
}

/** 글감 목록을 최근 수정순으로 가져온다. status를 주면 그 상태만, 생략하면 전체다. */
export function fetchIdeas(status: IdeaStatus | undefined, signal: AbortSignal): Promise<IdeaListResponse> {
  return apiGet<IdeaListResponse>('/ideas', { query: { status }, baseUrl: SERVER_API_URL, signal })
}

export interface UpdateIdeaInput {
  title?: string
  memo?: string
  type?: PostType
  status?: IdeaStatus
}

/** 글감의 일부 필드를 고친다. 하나 이상 보내야 하고, 서버가 검증한다. */
export function updateIdea(id: string, input: UpdateIdeaInput, signal?: AbortSignal): Promise<SavedIdea> {
  return apiPatch<SavedIdea>(`/ideas/${encodeURIComponent(id)}`, input, { baseUrl: SERVER_API_URL, signal })
}
