import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts가 VITE_BLOG_LOGIN_URL로 주입하는 더미 블로그 오리진
const BLOG_ORIGIN = 'http://localhost:3999'

/** 시간대에 따라 날짜가 밀리지 않도록 한낮으로 고정한다. */
const CREATED_AT = '2026-10-08T12:00:00Z'

function buildResponse(slugs: string[]) {
  const data = slugs.map((slug) => ({
    id: `id-${slug}`,
    title: `제목 ${slug}`,
    slug,
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

/** 글 목록은 draft 쿼리로 보기별 응답을 나눈다. */
async function mockManageApis(page: Page, { published = ['pub-a', 'pub-b'], drafts = ['draft-a'] }: MockOptions = {}) {
  await page.route(/\/api\/categories(\?|$)/, async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route(/\/api\/(projects|lab|devlog)(\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const draft = url.searchParams.get('draft')

    await route.fulfill({ json: buildResponse(draft === 'true' ? drafts : published) })
  })
}

test('프로젝트 발행됨 목록의 편집 링크는 새 탭으로 열리는 블로그 편집 주소다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page)

  await page.goto('/manage')

  const links = page.getByRole('link', { name: '편집' })
  await expect(links).toHaveCount(2)
  await expect(links.nth(0)).toHaveAttribute('href', `${BLOG_ORIGIN}/projects/pub-a/edit`)
  await expect(links.nth(1)).toHaveAttribute('href', `${BLOG_ORIGIN}/projects/pub-b/edit`)
  await expect(links.nth(0)).toHaveAttribute('target', '_blank')
  await expect(links.nth(0)).toHaveAttribute('rel', 'noopener noreferrer')
})

test('임시저장 탭에서도 편집 링크가 보이고 랩과 개발일지는 종류별 경로를 쓴다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page)
  await page.goto('/manage')
  await expect(page.getByText('제목 pub-a')).toBeVisible()

  await page.getByRole('tab', { name: '임시저장' }).click()

  await expect(page.getByText('제목 draft-a')).toBeVisible()
  await expect(page.getByRole('link', { name: '편집' })).toHaveAttribute('href', `${BLOG_ORIGIN}/projects/draft-a/edit`)

  await page.getByRole('tab', { name: '랩' }).click()

  await expect(page.getByRole('link', { name: '편집' })).toHaveAttribute('href', `${BLOG_ORIGIN}/lab/draft-a/edit`)

  await page.getByRole('tab', { name: '개발일지' }).click()

  await expect(page.getByRole('link', { name: '편집' })).toHaveAttribute('href', `${BLOG_ORIGIN}/devlog/draft-a/edit`)
})

test('slug에 공백이 있으면 편집 링크 href에 %20으로 인코딩된다', async ({ page }) => {
  await seedAuthToken(page)
  await mockManageApis(page, { published: ['hello world'] })

  await page.goto('/manage')

  await expect(page.getByRole('link', { name: '편집' })).toHaveAttribute(
    'href',
    `${BLOG_ORIGIN}/projects/hello%20world/edit`,
  )
})
