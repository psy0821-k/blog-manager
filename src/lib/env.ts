/** 주소 끝의 슬래시를 제거한다. 값이 없으면 빈 문자열. */
function trimTrailingSlash(url: string | undefined): string {
  return (url ?? '').replace(/\/$/, '')
}

/** 블로그 API 기본 주소. 비어 있으면 상대 경로(/api)로 호출한다(개발 프록시). */
export const BLOG_API_URL: string = trimTrailingSlash(import.meta.env.VITE_BLOG_API_URL)

/** 블로그 관리자 로그인 페이지 주소. 비어 있으면 로그인 이동이 불가능하다. */
export const BLOG_LOGIN_URL: string = trimTrailingSlash(import.meta.env.VITE_BLOG_LOGIN_URL)
