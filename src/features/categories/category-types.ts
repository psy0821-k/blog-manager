import type { PostType } from '../posts/post-types'

export interface Category {
  id: string
  type: PostType
  name: string
  slug: string
  order: number
}
