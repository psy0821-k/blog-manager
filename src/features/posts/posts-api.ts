import { apiDelete, apiGet, apiPatch } from '../../lib/api-client'
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

/** 종류별 경로 + 인코딩된 slug. updatePostPublished와 deletePost가 공유한다. */
function buildPostPath(type: PostType, slug: string): string {
  return `${POST_LIST_PATHS[type]}/${encodeURIComponent(slug)}`
}

/** 글의 발행 여부를 바꾼다. 성공 응답(글 JSON)은 쓰지 않으므로 반환하지 않는다. */
export async function updatePostPublished(type: PostType, slug: string, published: boolean): Promise<void> {
  await apiPatch<unknown>(buildPostPath(type, slug), { published })
}

/** 글을 삭제한다. 성공 응답은 본문이 없으므로 반환하지 않는다. */
export async function deletePost(type: PostType, slug: string): Promise<void> {
  await apiDelete(buildPostPath(type, slug))
}
