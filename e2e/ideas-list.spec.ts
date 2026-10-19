import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const IDEAS_PATTERN = /\/server-api\/ideas(\?|$)/

const TODO_IDEA = {
  id: 'idea-todo',
  title: '대기 중인 글감',
  memo: '- 대기 메모',
  type: 'DEV_LOG',
  status: 'todo',
  createdAt: '2026-10-17T00:00:00.000Z',
}

const DOING_IDEA = {
  id: 'idea-doing',
  title: '진행 중인 글감',
  memo: '- 진행 메모 첫 줄\n- 진행 메모 둘째 줄',
  type: 'LAB',
  status: 'doing',
  createdAt: '2026-10-19T00:00:00.000Z',
}

const ALL_IDEAS = [DOING_IDEA, TODO_IDEA]

interface IdeaListRequest {
  method: string
  authorization: string | undefined
  status: string | null
}

/** 대시보드의 글 목록 API(성실도·최근 글·임시저장)를 빈 목록으로 응답한다. */
async function mockPostApis(page: Page) {
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    await route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 30, totalCount: 0, totalPages: 1 } } })
  })
}

/** 글감 목록 요청(GET /server-api/ideas)을 가로채 기록하고, 요청한 status로 거른 목록을 응답한다. 요청 수는 응답하는 route 안에서 센다. */
async function mockIdeaList(page: Page, ideas = ALL_IDEAS) {
  const requests: IdeaListRequest[] = []

  await page.route(IDEAS_PATTERN, async (route) => {
    const request = route.request()
    const status = new URL(request.url()).searchParams.get('status')
    requests.push({ method: request.method(), authorization: request.headers().authorization, status })

    await route.fulfill({ json: { data: status ? ideas.filter((idea) => idea.status === status) : ideas } })
  })

  return requests
}

test('토큰이 있을 때 /ideas를 열면 준비 중 화면이 아니라 글감 목록이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  const requests = await mockIdeaList(page)

  await page.goto('/ideas')

  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /대기 중인 글감/ })).toBeVisible()
  await expect(page.getByText('준비 중입니다.')).toHaveCount(0)
  expect(requests[0].method).toBe('GET')
  expect(requests[0].authorization).toMatch(/^Bearer .+/)
  expect(requests[0].status).toBeNull()
})

test('사이드바의 글감 메뉴로 /ideas에 들어갈 수 있다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaList(page)

  await page.goto('/')
  await page.getByRole('link', { name: '글감 아이디어' }).click()

  await expect(page).toHaveURL(/\/ideas$/)
  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toBeVisible()
})

test('진행 탭을 누르면 GET /server-api/ideas?status=doing 요청이 나가고 그 응답만 보인다', async ({ page }) => {
  await seedAuthToken(page)
  const requests = await mockIdeaList(page)
  await page.goto('/ideas')
  await expect(page.getByRole('row', { name: /대기 중인 글감/ })).toBeVisible()

  await page.getByRole('tab', { name: '진행' }).click()

  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /대기 중인 글감/ })).toHaveCount(0)
  await expect(page).toHaveURL(/\/ideas\?status=doing$/)
  expect(requests.at(-1)?.status).toBe('doing')
})

test('행을 누르면 상세 모달이 열리고 메모 전문이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaList(page)
  await page.goto('/ideas')

  await page.getByRole('row', { name: /진행 중인 글감/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/진행 메모 첫 줄/)).toBeVisible()
  await expect(dialog.getByText(/진행 메모 둘째 줄/)).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
})

test('글감이 없으면 빈 상태 안내가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaList(page, [])

  await page.goto('/ideas')

  await expect(page.getByText('글감이 없습니다.')).toBeVisible()
})

test('서버가 500을 주면 오류 문구가 보이고 "다시 시도"로 복구할 수 있다', async ({ page }) => {
  await seedAuthToken(page)
  let failing = true

  await page.route(IDEAS_PATTERN, async (route) => {
    if (failing) {
      await route.fulfill({ status: 500, json: {} })
      return
    }

    await route.fulfill({ json: { data: ALL_IDEAS } })
  })

  await page.goto('/ideas')
  const retryButton = page.getByRole('button', { name: '다시 시도' })
  await expect(retryButton).toBeVisible()
  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toHaveCount(0)

  failing = false
  await retryButton.click()

  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toBeVisible()
  await expect(retryButton).toHaveCount(0)
})

test('서버가 401을 주면 블로그 로그인으로 이동한다', async ({ page }) => {
  await seedAuthToken(page)
  const loginRequests: string[] = []

  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    loginRequests.push(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
  })
  await page.route(IDEAS_PATTERN, (route) => route.fulfill({ status: 401, json: {} }))

  await page.goto('/ideas').catch(() => {})

  await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
  expect(new URL(loginRequests[0]).pathname).toBe('/admin-login')
})
