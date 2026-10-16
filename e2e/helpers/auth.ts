import type { Page } from '@playwright/test'

// src/lib/auth-token.ts의 TOKEN_STORAGE_KEY와 같은 값
export const TOKEN_STORAGE_KEY = 'blog-manager-token'

/** payload에 exp(초)만 가진 JWT를 만든다. */
export function createAuthToken(expOffsetSeconds = 60 * 60): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')

  return `header.${payload}.signature`
}

/** 페이지가 열리기 전에 만료가 먼 토큰을 sessionStorage에 심는다. */
export async function seedAuthToken(page: Page): Promise<void> {
  const token = createAuthToken()

  await page.addInitScript(
    ({ key, value }) => {
      sessionStorage.setItem(key, value)
    },
    { key: TOKEN_STORAGE_KEY, value: token },
  )
}
