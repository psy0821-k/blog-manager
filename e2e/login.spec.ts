import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createAuthToken, seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const BLOG_LOGIN_URL = `${BLOG_LOGIN_ORIGIN}/admin-login`
const APP_ORIGIN = 'http://localhost:5173'
const CALLBACK_URL = `${APP_ORIGIN}/auth/callback`
// 복귀 경로 저장 키(구현 시그니처에 명시되지 않은 값이라 Green 단계에서 맞춘다)
const RETURN_PATH_STORAGE_KEY = 'blog-manager-return-path'

/** 블로그 로그인 요청을 가로채 주어진 주소로 이동시키는 HTML을 응답한다. */
async function mockBlogLogin(page: Page, getNextUrl: () => string, delayMs = 0) {
  const requestedUrls: string[] = []

  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    requestedUrls.push(route.request().url())

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(getNextUrl())})</script>`,
    })
  })

  return requestedUrls
}

function sideNav(page: Page) {
  return page.getByText('blogManager')
}

test('토큰 없이 /manage에 접속하면 블로그 로그인 주소로 이동한다', async ({ page }) => {
  // 사이드바가 그려지지 않는 것은 require-auth 단위 테스트가, 복귀는 아래 콜백 시나리오가 검증한다
  const requests = await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/manage', { waitUntil: 'commit' }).catch(() => {})
  await expect.poll(() => requests.length).toBeGreaterThan(0)

  const loginUrl = new URL(requests[0])
  expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(BLOG_LOGIN_URL)
  expect(loginUrl.searchParams.get('redirect')).toBe(CALLBACK_URL)
})

test('콜백 후 처음 가려던 /manage가 표시되고 주소창에 token이 남지 않는다', async ({ page }) => {
  await mockBlogLogin(page, () => `${CALLBACK_URL}#token=${createAuthToken()}`)

  await page.goto('/manage')

  await expect(page).toHaveURL(`${APP_ORIGIN}/manage`)
  await expect(sideNav(page)).toBeVisible()
  expect(page.url()).not.toContain('token')
})

test('로그인을 여러 번 경유해도 처음 가려던 /manage가 표시된다', async ({ page }) => {
  const token = createAuthToken()
  let step = 0
  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    step += 1
    await new Promise((resolve) => setTimeout(resolve, 300))
    const next = step === 1 ? `${BLOG_LOGIN_ORIGIN}/admin/login` : `${CALLBACK_URL}#token=${token}`

    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(next)})</script>`,
    })
  })

  await page.goto('/manage')

  await expect(page).toHaveURL(`${APP_ORIGIN}/manage`)
  await expect(sideNav(page)).toBeVisible()
})

test('복귀 경로가 /login이면 콜백 후 / 대시보드가 표시된다', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      sessionStorage.setItem(key, '/login')
    },
    { key: RETURN_PATH_STORAGE_KEY },
  )

  await page.goto(`/auth/callback#token=${createAuthToken()}`)

  await expect(page).toHaveURL(`${APP_ORIGIN}/`)
  await expect(page.getByText('주차별 성실도').first()).toBeVisible()
})

test('유효한 토큰이면 /와 /manage를 오가도 블로그 로그인 주소로 이동하지 않는다', async ({ page }) => {
  const requests = await mockBlogLogin(page, () => 'about:blank')
  await seedAuthToken(page)
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 1, totalCount: 0, totalPages: 0 } } }),
  )

  await page.goto('/')
  await page.getByRole('link', { name: '컨텐츠 관리' }).click()
  await expect(page).toHaveURL(`${APP_ORIGIN}/manage`)
  await page.getByRole('link', { name: 'blogManager' }).click()
  await expect(page).toHaveURL(`${APP_ORIGIN}/`)

  expect(requests).toHaveLength(0)
})
