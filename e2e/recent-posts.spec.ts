import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

const POSTS = {
  projects: { id: 'p1', title: '프로젝트 최신글' },
  lab: { id: 'l1', title: '랩 최신글' },
  devlog: { id: 'd1', title: '개발일지 최신글' },
} as const

type Endpoint = keyof typeof POSTS

/** 시간대에 따라 날짜가 밀리지 않도록 한낮으로 고정한다. */
const CREATED_AT = '2026-10-08T12:00:00Z'

function buildResponse(endpoint: Endpoint, pageSize: number) {
  const { id, title } = POSTS[endpoint]
  const data = [{ id, title, slug: id, viewCount: 0, createdAt: CREATED_AT, updatedAt: CREATED_AT }]

  return {
    data: data.slice(0, pageSize),
    meta: { page: 1, pageSize, totalCount: data.length, totalPages: 1 },
  }
}

/** 세 글 목록 API를 가로채 pageSize만큼 잘라 응답한다. shouldFail이 true를 돌려주면 500으로 실패시킨다. */
async function mockPostApis(page: Page, shouldFail: (endpoint: Endpoint, pageSize: number) => boolean = () => false) {
  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const endpoint = url.pathname.split('/').pop() as Endpoint
    const pageSize = Number(url.searchParams.get('pageSize') ?? 30)

    if (shouldFail(endpoint, pageSize)) {
      await route.fulfill({ status: 500, json: { message: 'error' } })
      return
    }

    await route.fulfill({ json: buildResponse(endpoint, pageSize) })
  })
}

function recentPostsCard(page: Page) {
  return page.locator('[data-slot="card"]').filter({ hasText: '최근 게시글' })
}

test('종류별 최신 글이 프로젝트, 랩, 개발일지 순서로 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockPostApis(page)

  await page.goto('/')

  const items = recentPostsCard(page).getByRole('listitem')
  await expect(items).toHaveCount(3)
  await expect(items.nth(0)).toContainText('프로젝트 최신글')
  await expect(items.nth(1)).toContainText('랩 최신글')
  await expect(items.nth(2)).toContainText('개발일지 최신글')
})

test('조회가 실패하면 에러를 보여 주고 다시 시도하면 복구된다', async ({ page }) => {
  await seedAuthToken(page)
  let failRecent = true
  // 주차별 성실도(pageSize 50)는 정상으로 두고 최근 게시글(pageSize 1)의 랩 요청만 실패시킨다
  await mockPostApis(page, (endpoint, pageSize) => failRecent && endpoint === 'lab' && pageSize === 1)

  await page.goto('/')

  const card = recentPostsCard(page)
  await expect(card.getByRole('alert')).toHaveText('글을 불러오지 못했습니다.')

  failRecent = false
  await card.getByRole('button', { name: '다시 시도' }).click()

  await expect(card.getByRole('alert')).toHaveCount(0)
  await expect(card.getByRole('listitem')).toHaveCount(3)
})
