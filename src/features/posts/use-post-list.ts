import { useCallback } from 'react'
import { useFetch } from '../../lib/use-fetch'
import { fetchPostList } from './posts-api'
import type { PostType } from './post-types'

/** draft가 true이면 임시저장 글, false이면 발행된 글을 조회한다. */
export function usePostList(type: PostType, page: number, q: string, category: string, draft: boolean) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchPostList({ type, page, q, category, draft }, signal),
    [type, page, q, category, draft],
  )

  return useFetch(fetcher)
}
