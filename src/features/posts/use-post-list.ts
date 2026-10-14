import { useCallback } from 'react'
import { useFetch } from '../../lib/use-fetch'
import { fetchPostList } from './posts-api'
import type { PostType } from './post-types'

export function usePostList(type: PostType, page: number, q: string, category: string) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchPostList({ type, page, q, category }, signal),
    [type, page, q, category],
  )

  return useFetch(fetcher)
}
