import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const IDEAS_LIST_PATTERN = /\/server-api\/ideas(\?|$)/
const IDEA_ITEM_PATTERN = /\/server-api\/ideas\/[^/?]+$/

const TODO_ID = '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c'
const DOING_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

interface FakeIdea {
  id: string
  title: string
  memo: string
  type: string
  status: string
  createdAt: string
}

function makeIdeas(): FakeIdea[] {
  return [
    {
      id: TODO_ID,
      title: '대기 중인 글감',
      memo: '- 대기 메모',
      type: 'DEV_LOG',
      status: 'todo',
      createdAt: '2026-10-17T00:00:00.000Z',
    },
    {
      id: DOING_ID,
      title: '진행 중인 글감',
      memo: '- 진행 메모',
      type: 'LAB',
      status: 'doing',
      createdAt: '2026-10-19T00:00:00.000Z',
    },
  ]
}

interface PatchRequest {
  method: string
  url: string
  authorization: string | undefined
  body: unknown
}

/** 대시보드의 글 목록 API(성실도·최근 글·임시저장)를 빈 목록으로 응답한다. */
async function mockPostApis(page: Page) {
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    await route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 30, totalCount: 0, totalPages: 1 } } })
  })
}

interface IdeaServerOptions {
  ideas?: FakeIdea[]
  /** PATCH에 응답하기 전에 기다릴 시간 */
  patchDelayMs?: number
  /** PATCH에 항상 이 상태 코드로 응답한다. 생략하면 성공(200)하고 저장된 글감을 바꾼다. */
  patchStatus?: number
}

/**
 * 글감 서버를 흉내 낸다. GET /server-api/ideas는 저장된 글감을 status로 걸러 돌려주고,
 * PATCH /server-api/ideas/<id>는 상태를 바꿔 저장한다. 요청 수는 응답하는 route 안에서 센다.
 */
async function mockIdeaServer(page: Page, { ideas = makeIdeas(), patchDelayMs = 0, patchStatus }: IdeaServerOptions = {}) {
  const stored = ideas
  const patches: PatchRequest[] = []

  await page.route(IDEAS_LIST_PATTERN, async (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')

    await route.fulfill({ json: { data: stored.filter((idea) => !status || idea.status === status) } })
  })

  await page.route(IDEA_ITEM_PATTERN, async (route) => {
    const request = route.request()
    patches.push({
      method: request.method(),
      url: request.url(),
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    })

    if (patchDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, patchDelayMs))
    }

    if (patchStatus && patchStatus !== 200) {
      await route.fulfill({ status: patchStatus, json: {} })
      return
    }

    const id = request.url().split('/').at(-1)
    const target = stored.find((idea) => idea.id === id)
    Object.assign(target ?? {}, request.postDataJSON())

    await route.fulfill({ json: target })
  })

  return patches
}

function rowOf(page: Page, title: string) {
  return page.getByRole('row', { name: new RegExp(title) })
}

test("대기 글감의 '진행' 버튼을 누르면 PATCH /server-api/ideas/<id>가 { status: 'doing' } 본문과 Bearer 토큰으로 한 번 가고 진행 버튼이 눌린 상태가 된다", async ({ page }) => {
  await seedAuthToken(page)
  const patches = await mockIdeaServer(page)
  await page.goto('/ideas')

  await rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' }).click()

  await expect(rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'true')
  expect(patches).toHaveLength(1)
  expect(patches[0].method).toBe('PATCH')
  expect(patches[0].url).toContain(`/server-api/ideas/${TODO_ID}`)
  expect(patches[0].authorization).toMatch(/^Bearer .+/)
  expect(patches[0].body).toEqual({ status: 'doing' })
})

test('글감을 진행으로 바꾼 뒤 대시보드로 가면 아이디어 진행 카드에 그 제목이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaServer(page, { ideas: makeIdeas().filter((idea) => idea.status === 'todo') })
  await page.goto('/ideas')

  await rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' }).click()
  await expect(rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('link', { name: '대시보드' }).first().click()

  const card = page.locator('[data-slot="card"]', { hasText: '아이디어 진행' })
  await expect(card.getByText('대기 중인 글감')).toBeVisible()
  await expect(card.getByText('지금 쓰고 있는 글감')).toBeVisible()
})

test('진행 글감이 없으면 대시보드 카드에 대기중인 아이디어 수가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await mockIdeaServer(page, { ideas: makeIdeas().filter((idea) => idea.status === 'todo') })

  await page.goto('/')

  const card = page.locator('[data-slot="card"]', { hasText: '아이디어 진행' })
  await expect(card.getByText('대기중인 아이디어 1개')).toBeVisible()
})

test('응답이 느릴 때 같은 버튼을 두 번 눌러도 PATCH는 한 번만 간다', async ({ page }) => {
  await seedAuthToken(page)
  const patches = await mockIdeaServer(page, { patchDelayMs: 500 })
  await page.goto('/ideas')
  const button = rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' })

  await button.click()
  await button.click({ force: true }).catch(() => {})

  await expect(rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' })).toHaveAttribute('aria-pressed', 'true')
  expect(patches).toHaveLength(1)
})

test('PATCH가 500이면 표 위에 오류 문구가 보이고 기존 상태가 유지되며 버튼이 다시 활성화된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaServer(page, { patchStatus: 500 })
  await page.goto('/ideas')

  await rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' }).click()

  await expect(page.getByRole('alert')).toContainText('상태를 바꾸지 못했습니다. (500)')
  await expect(rowOf(page, '대기 중인 글감').getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'true')
  await expect(rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' })).toBeEnabled()
})

test("PATCH가 404이면 '이미 삭제된 글감입니다'가 보이고 목록을 다시 불러온다", async ({ page }) => {
  await seedAuthToken(page)
  let listRequests = 0
  await mockIdeaServer(page, { patchStatus: 404 })
  await page.route(IDEAS_LIST_PATTERN, async (route) => {
    listRequests += 1
    await route.fallback()
  })
  await page.goto('/ideas')
  await expect(rowOf(page, '대기 중인 글감')).toBeVisible()
  const before = listRequests

  await rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' }).click()

  await expect(page.getByRole('alert')).toContainText('이미 삭제된 글감입니다')
  await expect.poll(() => listRequests).toBeGreaterThan(before)
})

test('PATCH가 401이면 블로그 로그인으로 이동한다', async ({ page }) => {
  await seedAuthToken(page)
  const loginRequests: string[] = []
  await mockIdeaServer(page, { patchStatus: 401 })
  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    loginRequests.push(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
  })
  await page.goto('/ideas')

  await rowOf(page, '대기 중인 글감').getByRole('button', { name: '진행' }).click()

  await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
  expect(new URL(loginRequests[0]).pathname).toBe('/admin-login')
})

test('대시보드의 글감 조회가 500이면 카드에 오류와 다시 시도가 보이고 다른 카드는 그대로다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)
  await page.route(IDEAS_LIST_PATTERN, (route) => route.fulfill({ status: 500, json: {} }))

  await page.goto('/')

  const card = page.locator('[data-slot="card"]', { hasText: '아이디어 진행' })
  await expect(card.getByRole('alert')).toContainText('글감을 불러오지 못했습니다.')
  await expect(card.getByRole('button', { name: '다시 시도' })).toBeVisible()
  await expect(page.getByText('최근 게시글')).toBeVisible()
})
