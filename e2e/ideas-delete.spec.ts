import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedAuthToken } from './helpers/auth'

// playwright.config.ts의 webServer.env로 주입하는 로컬 더미 블로그 로그인 주소와 같은 값
const BLOG_LOGIN_ORIGIN = 'http://localhost:3999'
const IDEAS_LIST_PATTERN = /\/server-api\/ideas(\?|$)/
const IDEA_ITEM_PATTERN = /\/server-api\/ideas\/[^/?]+$/

const DOING_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const TODO_ID = '3f2b8c1e-5a4d-4e7b-9c6a-1d2e3f4a5b6c'

interface FakeIdea {
  id: string
  title: string
  memo: string
  type: string
  status: string
  createdAt: string
}

interface DeleteRequest {
  method: string
  url: string
  authorization: string | undefined
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
    {
      id: TODO_ID,
      title: '대기 중인 글감',
      memo: '- 대기 메모',
      type: 'DEV_LOG',
      status: 'todo',
      createdAt: '2026-10-17T00:00:00.000Z',
    },
  ]
}

interface IdeaServerOptions {
  /** DELETE에 응답하기 전에 기다릴 시간 */
  deleteDelayMs?: number
  /** DELETE에 항상 이 상태 코드로 응답한다. 생략하면 성공(204)하고 저장된 글감을 지운다. */
  deleteStatus?: number
}

/**
 * 상태를 가진 글감 서버를 흉내 낸다. GET /server-api/ideas는 저장된 글감을 돌려주고,
 * DELETE /server-api/ideas/<id>는 글감을 지운다. DELETE 요청 수는 응답하는 route 안에서 센다.
 */
async function mockIdeaServer(page: Page, { deleteDelayMs = 0, deleteStatus }: IdeaServerOptions = {}) {
  let stored = makeIdeas()
  const deletes: DeleteRequest[] = []

  await page.route(IDEAS_LIST_PATTERN, async (route) => {
    await route.fulfill({ json: { data: stored } })
  })

  await page.route(IDEA_ITEM_PATTERN, async (route) => {
    const request = route.request()
    deletes.push({ method: request.method(), url: request.url(), authorization: request.headers().authorization })

    if (deleteDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, deleteDelayMs))
    }

    if (deleteStatus && deleteStatus !== 204) {
      await route.fulfill({ status: deleteStatus, json: {} })
      return
    }

    const id = request.url().split('/').at(-1)
    stored = stored.filter((idea) => idea.id !== id)

    await route.fulfill({ status: 204 })
  })

  return deletes
}

/** 행의 제목 칸을 눌러 상세 모달을 열고 삭제를 눌러 확인 대화상자를 연다. */
async function openConfirm(page: Page, title: string) {
  await page.getByRole('row', { name: new RegExp(title) }).getByText(title).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: '글감 삭제' })
  await expect(confirm).toBeVisible()

  return confirm
}

test('상세 모달에서 삭제를 누르고 확정하면 DELETE /server-api/ideas/<id>가 Bearer 토큰과 함께 한 번 가고 목록에서 그 글감이 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  const deletes = await mockIdeaServer(page)
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')
  await expect(confirm.getByText('「진행 중인 글감」을 삭제할까요? 되돌릴 수 없습니다.')).toBeVisible()

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(confirm).toBeHidden()
  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /대기 중인 글감/ })).toBeVisible()
  expect(deletes).toHaveLength(1)
  expect(deletes[0].method).toBe('DELETE')
  expect(deletes[0].url).toContain(`/server-api/ideas/${DOING_ID}`)
  expect(deletes[0].authorization).toMatch(/^Bearer .+/)
})

test('확인 대화상자에서 취소하면 DELETE가 가지 않고 상세 모달로 돌아간다', async ({ page }) => {
  await seedAuthToken(page)
  const deletes = await mockIdeaServer(page)
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')

  await confirm.getByRole('button', { name: '취소' }).click()

  await expect(page.getByRole('dialog', { name: '진행 중인 글감' })).toBeVisible()
  expect(deletes).toHaveLength(0)
})

test('응답이 느릴 때 확정 버튼을 두 번 눌러도 DELETE는 한 번만 간다', async ({ page }) => {
  await seedAuthToken(page)
  const deletes = await mockIdeaServer(page, { deleteDelayMs: 500 })
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()
  await confirm.getByRole('button', { name: '삭제 중…' }).click({ force: true }).catch(() => {})

  await expect(confirm).toBeHidden()
  expect(deletes).toHaveLength(1)
})

test('응답이 느릴 때 확정하면 대화상자에 로딩 스피너가 보이다가 응답이 오면 사라진다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaServer(page, { deleteDelayMs: 800 })
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')
  await expect(confirm.getByRole('status', { name: '삭제 중' })).toHaveCount(0)

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(confirm.getByRole('status', { name: '삭제 중' })).toBeVisible()
  await expect(confirm).toBeHidden()
  await expect(page.getByRole('status', { name: '삭제 중' })).toHaveCount(0)
})

test('DELETE가 500이면 대화상자가 닫히고 표 위에 오류 문구가 보이며 글감이 그대로 있다', async ({ page }) => {
  await seedAuthToken(page)
  await mockIdeaServer(page, { deleteStatus: 500 })
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(confirm).toBeHidden()
  await expect(page.getByRole('alert')).toContainText('삭제하지 못했습니다. (500)')
  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toBeVisible()
})

test("DELETE가 404이면 '이미 삭제된 글감입니다'가 보이고 목록에서 그 글감이 사라진다", async ({ page }) => {
  await seedAuthToken(page)
  const deletes = await mockIdeaServer(page, { deleteStatus: 404 })
  // 404는 서버에서 이미 지워졌다는 뜻이므로 다시 조회한 목록에는 그 글감이 없다
  await page.route(IDEAS_LIST_PATTERN, async (route) => {
    const alreadyDeleted = deletes.length > 0
    await route.fulfill({ json: { data: makeIdeas().filter((idea) => !alreadyDeleted || idea.id !== DOING_ID) } })
  })
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText('이미 삭제된 글감입니다')
  await expect(page.getByRole('row', { name: /진행 중인 글감/ })).toHaveCount(0)
})

test('DELETE가 401이면 블로그 로그인으로 이동한다', async ({ page }) => {
  await seedAuthToken(page)
  const loginRequests: string[] = []
  await mockIdeaServer(page, { deleteStatus: 401 })
  await page.route(`${BLOG_LOGIN_ORIGIN}/**`, async (route) => {
    loginRequests.push(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<script>location.replace("about:blank")</script>' })
  })
  await page.goto('/ideas')
  const confirm = await openConfirm(page, '진행 중인 글감')

  await confirm.getByRole('button', { name: '삭제', exact: true }).click()

  await expect.poll(() => loginRequests.length).toBeGreaterThan(0)
  expect(new URL(loginRequests[0]).pathname).toBe('/admin-login')
})
