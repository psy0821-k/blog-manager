import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

const PUBLISHED_TITLE = '발행된 글 제목'
const DRAFT_TITLE = '임시저장 글 제목'

/** 시간대에 따라 날짜가 밀리지 않도록 한낮으로 고정한다. */
const CREATED_AT = '2026-10-08T12:00:00Z'

function buildResponse(titles: string[]) {
  const data = titles.map((title, index) => ({
    id: `post-${index}`,
    title,
    slug: `post-${index}`,
    viewCount: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }))

  return { data, meta: { page: 1, pageSize: 30, totalCount: data.length, totalPages: 1 } }
}

interface MockOptions {
  published?: string[]
  drafts?: string[]
}

/** 글 목록은 draft 쿼리로 보기별 응답을 나누고, 요청된 draft 값을 기록해 돌려준다. */
async function mockManageApis(page: Page, { published = [PUBLISHED_TITLE], drafts = [DRAFT_TITLE] }: MockOptions = {}) {
  const requestedDrafts: Array<string | null> = []

  await page.route(/\/api\/categories(\?|$)/, async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const draft = url.searchParams.get('draft')
    requestedDrafts.push(draft)

    await route.fulfill({ json: buildResponse(draft === 'true' ? drafts : published) })
  })

  return requestedDrafts
}

test('처음 진입하면 발행됨 탭이 선택되고 draft 없이 요청하며 발행 글이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  const requestedDrafts = await mockManageApis(page)

  await page.goto('/manage')

  await expect(page.getByText(PUBLISHED_TITLE)).toBeVisible()
  await expect(page.getByRole('tab', { name: '발행됨' })).toHaveAttribute('aria-selected', 'true')
  expect(page.url()).not.toContain('draft=')
  expect(requestedDrafts.every((draft) => draft === null)).toBe(true)
})

test('임시저장 탭을 누르면 주소에 draft=true가 붙고 임시저장 글만 보인다', async ({ page }) => {
  await seedAuthToken(page)
  const requestedDrafts = await mockManageApis(page)
  await page.goto('/manage')
  await expect(page.getByText(PUBLISHED_TITLE)).toBeVisible()

  await page.getByRole('tab', { name: '임시저장' }).click()

  await expect(page.getByText(DRAFT_TITLE)).toBeVisible()
  await expect(page.getByText(PUBLISHED_TITLE)).toHaveCount(0)
  await expect(page).toHaveURL(/draft=true/)
  expect(requestedDrafts).toContain('true')
})

test('?draft=true로 직접 진입하거나 새로고침해도 임시저장 탭이 유지된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page)

  await page.goto('/manage?draft=true')

  await expect(page.getByText(DRAFT_TITLE)).toBeVisible()
  await expect(page.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'true')

  await page.reload()

  await expect(page.getByText(DRAFT_TITLE)).toBeVisible()
  await expect(page.getByRole('tab', { name: '임시저장' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/draft=true/)
})

test('임시저장에서 발행됨으로 돌아오면 draft가 주소에서 사라지고 발행 글이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page)
  await page.goto('/manage?draft=true')
  await expect(page.getByText(DRAFT_TITLE)).toBeVisible()

  await page.getByRole('tab', { name: '발행됨' }).click()

  await expect(page.getByText(PUBLISHED_TITLE)).toBeVisible()
  await expect(page.getByText(DRAFT_TITLE)).toHaveCount(0)
  expect(page.url()).not.toContain('draft=')
})

test('빈 목록이면 보기별 문구가 보인다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page, { published: [], drafts: [] })

  await page.goto('/manage')
  await expect(page.getByText('글이 없습니다.', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: '임시저장' }).click()

  await expect(page.getByText('임시저장 글이 없습니다.')).toBeVisible()
  await expect(page.getByText('글이 없습니다.', { exact: true })).toHaveCount(0)
})
