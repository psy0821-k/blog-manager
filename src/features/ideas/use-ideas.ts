import { useCallback } from 'react'
import { useFetch } from '../../lib/use-fetch'
import type { IdeaStatus } from './idea-types'
import { fetchIdeas } from './ideas-api'

/** status를 주면 그 상태의 글감만, 생략하면 전체를 조회한다. */
export function useIdeas(status?: IdeaStatus) {
  const fetcher = useCallback((signal: AbortSignal) => fetchIdeas(status, signal), [status])

  return useFetch(fetcher)
}
