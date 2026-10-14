import { apiGet } from '../../lib/api-client'
import type { PostListResponse, PostType } from './post-types'

const POST_LIST_PATHS: Record<PostType, string> = {
  PROJECT: '/api/projects',
  LAB: '/api/lab',
  DEV_LOG: '/api/devlog',
}

export interface PostListParams {
  type: PostType
  page: number
  q?: string
  category?: string
  /** 한 번에 받을 개수. 생략하면 서버 기본값(30), 최대 50 */
  pageSize?: number
  /** true이면 임시저장 글을 조회한다 (관리자 토큰 필요) */
  draft?: boolean
}

export function fetchPostList(
  { type, page, q, category, pageSize, draft }: PostListParams,
  signal: AbortSignal,
): Promise<PostListResponse> {
  return apiGet<PostListResponse>(POST_LIST_PATHS[type], {
    query: { page, q, category, pageSize, draft: draft ? 'true' : undefined },
    signal,
  })
}
