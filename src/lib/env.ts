/** 블로그 API 기본 주소. 비어 있으면 상대 경로(/api)로 호출한다(개발 프록시). */
export const BLOG_API_URL: string = (import.meta.env.VITE_BLOG_API_URL ?? '').replace(/\/$/, '')
