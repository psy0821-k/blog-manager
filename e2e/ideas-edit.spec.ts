import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const IDEAS_LIST_PATTERN = /\/server-api\/ideas(\?|$)/
const IDEA_ITEM_PATTERN = /\/server-api\/ideas\/[^/?]+$/

const DOING_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

interface FakeIdea {
  id: string
  title: string
  memo: string
  type: string
  status: string
  createdAt: string
}

interface WriteRequest {
  method: string
  url: string
  authorization: string | undefined
  body: unknown
}

function makeIdeas(): FakeIdea[] {
  return [
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

interface IdeaServerOptions {
  /** 쓰기 요청(POST, PATCH)에 호출 순서대로 응답할 상태 코드. 넘치면 마지막 값을 반복한다. 생략하면 항상 성공한다. */
  writeStatuses?: number[]
}

/**
 * 상태를 가진 글감 서버를 흉내 낸다. GET /server-api/ideas는 저장된 글감을 돌려주고,
 * POST는 새 글감을 대기 상태로 맨 앞에 추가하며, PATCH /server-api/ideas/<id>는 보낸 필드를 바꿔 저장한다.
 * 쓰기 요청 수는 응답하는 route 안에서 센다.
 */
async function mockIdeaServer(page: Page, { writeStatuses }: IdeaServerOptions = {}) {
  let stored = makeIdeas()
  const writes: WriteRequest[] = []

  function statusForNextWrite(): number {
    if (!writeStatuses) return 200

    return writeStatuses[Math.min(writes.length - 1, writeStatuses.length - 1)]
  }

  await page.route(IDEAS_LIST_PATTERN, async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ json: { data: stored } })
      return
    }

    writes.push({
      method: request.method(),
      url: request.url(),
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    })
    const status = statusForNextWrite()

    if (status !== 200) {
      await route.fulfill({ status, json: {} })
      return
    }

    const created: FakeIdea = {
      id: `new-${writes.length}`,
      status: 'todo',
      createdAt: '2026-10-20T00:00:00.000Z',
      ...(request.postDataJSON() as Pick<FakeIdea, 'title' | 'memo' | 'type'>),
    }
    stored = [created, ...stored]

    await route.fulfill({ status: 201, json: created })
  })

  await page.route(IDEA_ITEM_PATTERN, async (route) => {
    const request = route.request()
    writes.push({
      method: request.method(),
      url: request.url(),
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    })
    const status = statusForNextWrite()

    if (status !== 200) {
      await route.fulfill({ status, json: {} })
      return
    }

    const id = request.url().split('/').at(-1)
    stored = stored.map((idea) => (idea.id === id ? { ...idea, ...request.postDataJSON() } : idea))

    await route.fulfill({ json: stored.find((idea) => idea.id === id) })
  })

  return writes
}

function quickAddTitle(page: Page) {
  return page.getByPlaceholder('제목').first()
}

async function openEditDialog(page: Page) {
  // 행 정중앙에는 상태 버튼이 있어서 제목 칸을 눌러야 상세 모달이 열린다
  await page.getByRole('row', { name: /진행 중인 글감/ }).getByText('진행 중인 글감').click()
  await page.getByRole('dialog').getByRole('button', { name: '수정' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeVisible()

  return dialog
}

test('제목을 입력해 추가하면 POST /server-api/ideas가 { title, memo, type } 본문과 Bearer 토큰으로 한 번 가고 목록에 새 글감이 대기 상태로 나타나며 입력창이 비워진다', async ({ page }) => {
  await seedAuthToken(page)
  const writes = await mockIdeaServer(page)
  await page.goto('/ideas')

  await quickAddTitle(page).fill('직접 추가한 글감')
  await page.getByRole('button', { name: '추가', exact: true }).click()

  const row = page.getByRole('row', { name: /직접 추가한 글감/ })
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: '대기' })).toHaveAttribute('aria-pressed', 'true')
  await expect(quickAddTitle(page)).toHaveValue('')
  expect(writes).toHaveLength(1)
  expect(writes[0].method).toBe('POST')
  expect(writes[0].authorization).toMatch(/^Bearer .+/)
  expect(writes[0].body).toEqual({ title: '직접 추가한 글감', memo: '', type: 'DEV_LOG' })
})

test('종류 버튼으로 랩을 고르고 추가하면 type이 LAB으로 전송된다', async ({ page }) => {
  await seedAuthToken(page)
  const writes = await mockIdeaServer(page)
  await page.goto('/ideas')

  await page.getByRole('button', { name: '랩', exact: true }).click()
  await quickAddTitle(page).fill('랩 글감')
  await quickAddTitle(page).press('Enter')

  await expect(page.getByRole('row', { name: /랩 글감/ })).toBeVisible()
  expect(writes[0].body).toEqual({ title: '랩 글감', memo: '', type: 'LAB' })
})

test('행을 눌러 상세에서 수정을 누르고 제목·메모를 바꿔 저장하면 PATCH가 바뀐 필드로 한 번 가고 목록과 상세에 바뀐 내용이 보인다', async ({ page }) => {
  await seedAuthToken(page)
  const writes = await mockIdeaServer(page)
  await page.goto('/ideas')
  const dialog = await openEditDialog(page)

  await dialog.getByPlaceholder('제목').fill('새로 고친 제목')
  await dialog.getByPlaceholder('메모').fill('- 새로 고친 메모')
  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  const detail = page.getByRole('dialog')
  await expect(detail.getByText('새로 고친 제목')).toBeVisible()
  await expect(detail.getByText('- 새로 고친 메모')).toBeVisible()
  // 상세 모달이 열려 있는 동안 배경(목록)은 aria-hidden이라 includeHidden으로 찾는다
  await expect(page.getByRole('row', { name: /새로 고친 제목/, includeHidden: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0].method).toBe('PATCH')
  expect(writes[0].url).toContain(`/server-api/ideas/${DOING_ID}`)
  expect(writes[0].authorization).toMatch(/^Bearer .+/)
  expect(writes[0].body).toEqual({ title: '새로 고친 제목', memo: '- 새로 고친 메모', type: 'LAB' })
})

test('제목이 100자에 이르면 더 입력되지 않는다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaServer(page)
  await page.goto('/ideas')

  await quickAddTitle(page).click()
  await page.keyboard.insertText('가'.repeat(120))

  await expect(quickAddTitle(page)).toHaveValue('가'.repeat(100))
})

test('메모가 2000자에 이르면 더 입력되지 않는다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaServer(page)
  await page.goto('/ideas')
  const dialog = await openEditDialog(page)

  await dialog.getByPlaceholder('메모').fill('')
  await dialog.getByPlaceholder('메모').click()
  await page.keyboard.insertText('나'.repeat(2100))

  await expect(dialog.getByPlaceholder('메모')).toHaveValue('나'.repeat(2000))
})

test('POST가 500이면 입력한 제목이 남고 오류 문구가 보이며 다시 추가해 성공하면 문구가 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  const writes = await mockIdeaServer(page, { writeStatuses: [500, 200] })
  await page.goto('/ideas')

  await quickAddTitle(page).fill('다시 추가할 글감')
  await page.getByRole('button', { name: '추가', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText('서버 오류로 저장하지 못했어요')
  await expect(quickAddTitle(page)).toHaveValue('다시 추가할 글감')

  await page.getByRole('button', { name: '추가', exact: true }).click()

  await expect(page.getByRole('row', { name: /다시 추가할 글감/ })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(writes).toHaveLength(2)
})

test('PATCH가 500이면 다이얼로그 안에 오류 문구가 보이고 입력이 유지되며 다시 저장해 성공한다', async ({ page }) => {
  await seedAuthToken(page)
  const writes = await mockIdeaServer(page, { writeStatuses: [500, 200] })
  await page.goto('/ideas')
  const dialog = await openEditDialog(page)
  await dialog.getByPlaceholder('제목').fill('다시 저장할 제목')

  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  await expect(dialog.getByRole('alert')).toContainText('서버 오류로 저장하지 못했어요')
  await expect(dialog.getByPlaceholder('제목')).toHaveValue('다시 저장할 제목')

  await dialog.getByRole('button', { name: '저장', exact: true }).click()

  await expect(page.getByRole('dialog').getByText('다시 저장할 제목')).toBeVisible()
  expect(writes).toHaveLength(2)
})

test('POST나 PATCH가 401이면 블로그 로그인으로 이동한다', async ({ page }) => {
  await seedAuthToken(page)
  const loginRequests: string[] = []
  await mockIdeaServer(page, { writeStatuses: [401] })
  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    loginRequests.push(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
  })
  await page.goto('/ideas')

  await quickAddTitle(page).fill('401 글감')
  await page.getByRole('button', { name: '추가', exact: true }).click()

  await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
  expect(new URL(loginRequests[0]).pathname).toBe('/admin-login')
})
