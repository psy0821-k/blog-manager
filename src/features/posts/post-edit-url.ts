import type { PostType } from './post-types'

/** 종류별 블로그 편집 화면 경로 세그먼트. */
const POST_EDIT_PATHS: Record<PostType, string> = {
  PROJECT: 'projects',
  LAB: 'lab',
  DEV_LOG: 'devlog',
}

/**
 * 블로그 로그인 주소에서 블로그 오리진(예: https://blog.example)을 얻는다.
 * 주소가 비어 있거나 올바른 http(s) URL이 아니면 null.
 */
export function getBlogOrigin(blogLoginUrl: string): string | null {
  try {
    const url = new URL(blogLoginUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/** 편집 화면 전체 주소: `<blogOrigin>/<종류 경로>/<encodeURIComponent(slug)>/edit`. */
export function buildPostEditUrl(type: PostType, slug: string, blogOrigin: string): string {
  return `${blogOrigin}/${POST_EDIT_PATHS[type]}/${encodeURIComponent(slug)}/edit`
}
