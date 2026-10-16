import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { TOKEN_STORAGE_KEY, createAuthToken } from './helpers/auth'

// E2E는 개발 서버를 끄고 실행한다(5173 서버를 재사용하면 아래 더미 로그인 주소를 읽지 못한다)
// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const BLOG_LOGIN_URL = `${BLOG_LOGIN_ORIGIN}/admin-login`
const APP_ORIGIN = 'http://localhost:5173'
const CALLBACK_URL = `${APP_ORIGIN}/auth/callback`
const INVALID_TOKEN_MESSAGE = '로그인 정보를 확인할 수 없습니다.'

/** 블로그 로그인 요청을 가로채 주어진 주소로 이동시키는 HTML을 응답한다. */
async function mockBlogLogin(page: Page, getNextUrl: () => string) {
  const requestedUrls: string[] = []

  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    requestedUrls.push(route.request().url())

    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(getNextUrl())})</script>`,
    })
  })

  return requestedUrls
}

/** 대시보드가 부르는 블로그 API를 빈 목록으로 막는다. */
async function mockPostApi(page: Page) {
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 1, totalCount: 0, totalPages: 0 } } }),
  )
}

async function readStoredToken(page: Page) {
  return page.evaluate((key) => sessionStorage.getItem(key), TOKEN_STORAGE_KEY)
}

test('콜백에 잘못된 토큰으로 접속하면 /login 오류 화면이 보이고 토큰이 저장되지 않는다', async ({ page }) => {
  await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/auth/callback#token=not-a-jwt')

  await expect(page).toHaveURL(`${APP_ORIGIN}/login?error=invalid-token`)
  await expect(page.getByText(INVALID_TOKEN_MESSAGE)).toBeVisible()
  await expect(page.getByRole('button', { name: '다시 로그인' })).toBeVisible()
  expect(await readStoredToken(page)).toBeNull()
})

test('콜백에 토큰이 없거나 만료된 토큰이면 같은 오류 화면으로 간다', async ({ page }) => {
  await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/auth/callback')
  await expect(page).toHaveURL(`${APP_ORIGIN}/login?error=invalid-token`)
  await expect(page.getByText(INVALID_TOKEN_MESSAGE)).toBeVisible()

  await page.goto(`/auth/callback#token=${createAuthToken(-60)}`)
  await expect(page).toHaveURL(`${APP_ORIGIN}/login?error=invalid-token`)
  await expect(page.getByText(INVALID_TOKEN_MESSAGE)).toBeVisible()
  expect(await readStoredToken(page)).toBeNull()
})

test('/login?error=access-denied는 안내만 보이고 블로그 로그인으로 자동 이동하지 않는다', async ({ page }) => {
  const requests = await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/login?error=access-denied')

  await expect(page.getByText('관리자 계정으로만 로그인할 수 있습니다.')).toBeVisible()
  await page.waitForTimeout(500)
  expect(requests).toHaveLength(0)
})

test('오류 화면에서 다시 로그인을 누르면 블로그 로그인이 시작되고 완료 후 /가 표시된다', async ({ page }) => {
  const requests = await mockBlogLogin(page, () => `${CALLBACK_URL}#token=${createAuthToken()}`)
  await mockPostApi(page)

  await page.goto('/login?error=access-denied')
  await page.getByRole('button', { name: '다시 로그인' }).click()

  await expect(page).toHaveURL(`${APP_ORIGIN}/`)
  await expect(page.getByText('주차별 성실도').first()).toBeVisible()
  expect(requests).toHaveLength(1)

  const loginUrl = new URL(requests[0])
  expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(BLOG_LOGIN_URL)
  expect(loginUrl.searchParams.get('redirect')).toBe(CALLBACK_URL)
})

test('로그아웃 안내 화면은 자동 이동하지 않고 다시 로그인을 누르면 로그인 후 /가 표시된다', async ({ page }) => {
  const requests = await mockBlogLogin(page, () => `${CALLBACK_URL}#token=${createAuthToken()}`)
  await mockPostApi(page)

  await page.goto('/login?loggedOut=1')

  await expect(page.getByText('로그아웃되었습니다.')).toBeVisible()
  await page.waitForTimeout(500)
  expect(requests).toHaveLength(0)

  await page.getByRole('button', { name: '다시 로그인' }).click()

  await expect(page).toHaveURL(`${APP_ORIGIN}/`)
  await expect(page.getByText('주차별 성실도').first()).toBeVisible()
  expect(requests).toHaveLength(1)
})

test('토큰 없이 /login에 접속하면 안내 없이 바로 블로그 로그인 주소로 이동한다', async ({ page }) => {
  const requests = await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/login', { waitUntil: 'commit' }).catch(() => {})
  await expect.poll(() => requests.length).toBeGreaterThan(0)

  const loginUrl = new URL(requests[0])
  expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(BLOG_LOGIN_URL)
  expect(loginUrl.searchParams.get('redirect')).toBe(CALLBACK_URL)
})
