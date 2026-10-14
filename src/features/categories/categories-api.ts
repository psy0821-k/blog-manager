import { apiGet } from '../../lib/api-client'
import type { PostType } from '../posts/post-types'
import type { Category } from './category-types'

export function fetchCategories(type: PostType, signal: AbortSignal): Promise<Category[]> {
  return apiGet<Category[]>('/api/categories', { query: { type }, signal })
}
