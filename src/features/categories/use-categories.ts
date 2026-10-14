import { useCallback } from 'react'
import { useFetch } from '../../lib/use-fetch'
import type { PostType } from '../posts/post-types'
import { fetchCategories } from './categories-api'

export function useCategories(type: PostType) {
  const fetcher = useCallback((signal: AbortSignal) => fetchCategories(type, signal), [type])

  return useFetch(fetcher)
}
