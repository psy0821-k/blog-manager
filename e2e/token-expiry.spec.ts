import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createAuthToken, TOKEN_STORAGE_KEY } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const BLOG_LOGIN_URL = `${BLOG_LOGIN_ORIGIN}/admin-login`
const APP_ORIGIN = 'http://localhost:5173'
const CALLBACK_URL = `${APP_ORIGIN}/auth/callback`
const API_PATTERN = /\/api\/(projects|lab|devlog)(\?|$)/
const EMPTY_LIST = { data: [], meta: { page: 1, pageSize: 1, totalCount: 0, totalPages: 0 } }

/** 첫 문서가 열리기 전에 한 번만 주어진 토큰을 sessionStorage에 심는다. */
async function seedToken(page: Page, token: string) {
  await page.addInitScript(
    ({ key, value }) => {
      const seededKey = `${key}-seeded`

      if (!sessionStorage.getItem(seededKey)) {
        sessionStorage.setItem(seededKey, '1')
        sessionStorage.setItem(key, value)
      }
    },
    { key: TOKEN_STORAGE_KEY, value: token },
  )
}

/** 블로그 로그인 요청을 가로채 요청 순서마다 정해진 주소로 이동시키는 HTML을 응답한다. */
async function mockBlogLogin(page: Page, getNextUrl: (requestCount: number) => string) {
  const requestedUrls: string[] = []

  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    requestedUrls.push(route.request().url())

    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(getNextUrl(requestedUrls.length))})</script>`,
    })
  })

  return requestedUrls
}

/** 블로그 로그인이 시작되기 전까지는 주어진 상태로, 시작된 뒤에는 200으로 목록 API에 응답한다. */
async function mockApi(page: Page, status: number, getLoginRequestCount: () => number) {
  await page.route(API_PATTERN, (route) =>
    getLoginRequestCount() === 0 ? route.fulfill({ status, json: {} }) : route.fulfill({ json: EMPTY_LIST }),
  )
}

function sideNav(page: Page) {
  return page.getByText('blogManager')
}

function expectBlogLoginRequest(requestedUrl: string) {
  const loginUrl = new URL(requestedUrl)

  expect(`${loginUrl.origin}${loginUrl.pathname}`).toBe(BLOG_LOGIN_URL)
  expect(loginUrl.searchParams.get('redirect')).toBe(CALLBACK_URL)
}

test('만료된 토큰으로 /manage에 접속하면 사이드바가 그려지지 않고 블로그 로그인 주소로 이동한다', async ({ page }) => {
  await seedToken(page, createAuthToken(-60))
  const requests = await mockBlogLogin(page, () => 'about:blank')

  await page.goto('/manage', { waitUntil: 'commit' }).catch(() => {})
  await expect.poll(() => requests.length).toBeGreaterThan(0)

  expectBlogLoginRequest(requests[0])
  await expect(sideNav(page)).toHaveCount(0)
})

test('만료된 토큰으로 접속해도 로그인 요청이 콜백으로 응답되면 로그인 화면 없이 /manage가 표시된다', async ({ page }) => {
  await seedToken(page, createAuthToken(-60))
  const validToken = createAuthToken()
  await mockBlogLogin(page, () => `${CALLBACK_URL}#token=${validToken}`)
  await page.route(API_PATTERN, (route) => route.fulfill({ json: EMPTY_LIST }))

  await page.goto('/manage')

  await expect(page).toHaveURL(`${APP_ORIGIN}/manage`)
  await expect(sideNav(page)).toBeVisible()
})

for (const status of [401, 403]) {
  test(`유효한 토큰으로 /를 열었는데 목록 API가 ${status}이면 블로그 로그인 주소로 이동한다`, async ({ page }) => {
    await seedToken(page, createAuthToken())
    const requests = await mockBlogLogin(page, () => 'about:blank')
    await mockApi(page, status, () => requests.length)

    await page.goto('/')
    await expect.poll(() => requests.length).toBeGreaterThan(0)

    expectBlogLoginRequest(requests[0])
  })
}

test('/manage?page=2에서 API가 401이어도 재로그인 후 /manage?page=2가 다시 표시된다', async ({ page }) => {
  await seedToken(page, createAuthToken())
  const validToken = createAuthToken()
  const requests = await mockBlogLogin(page, () => `${CALLBACK_URL}#token=${validToken}`)
  await mockApi(page, 401, () => requests.length)

  await page.goto('/manage?page=2')

  await expect.poll(() => requests.length).toBeGreaterThan(0)
  expectBlogLoginRequest(requests[0])
  await expect(page).toHaveURL(`${APP_ORIGIN}/manage?page=2`)
  await expect(sideNav(page)).toBeVisible()
})

test('projects, lab, devlog 요청이 모두 401이어도 블로그 로그인 요청은 정확히 한 번이다', async ({ page }) => {
  await seedToken(page, createAuthToken())
  const requests = await mockBlogLogin(page, () => 'about:blank')
  await page.route(API_PATTERN, (route) => route.fulfill({ status: 401, json: {} }))

  await page.goto('/')
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  // 중복 요청이 늦게 도착하는 경우를 놓치지 않도록 잠시 더 기다린다
  await page.waitForTimeout(1000)

  expect(requests).toHaveLength(1)
})

test('블로그 세션이 없어 로그인 화면을 한 번 더 거쳐도 처음 보던 경로가 표시된다', async ({ page }) => {
  await seedToken(page, createAuthToken())
  const validToken = createAuthToken()
  const requests = await mockBlogLogin(page, (requestCount) =>
    requestCount === 1 ? `${BLOG_LOGIN_ORIGIN}/admin/login` : `${CALLBACK_URL}#token=${validToken}`,
  )
  await mockApi(page, 401, () => requests.length)

  await page.goto('/manage?page=2')

  await expect(page).toHaveURL(`${APP_ORIGIN}/manage?page=2`)
  await expect(sideNav(page)).toBeVisible()
  expect(requests.length).toBeGreaterThanOrEqual(2)
})
